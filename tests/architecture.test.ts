import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = resolve("src");
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) ? [file] : [];
  });
}
const files = sourceFiles(root).map((file) => {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const imports: { value: string; typeOnly: boolean }[] = [];
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = ts.isImportDeclaration(node) ? node.importClause : undefined;
      const bindings = clause?.namedBindings;
      const typeOnly = Boolean(clause?.isTypeOnly || (ts.isExportDeclaration(node) && node.isTypeOnly)
        || (clause && !clause.name && bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly)));
      imports.push({ value: node.moduleSpecifier.text, typeOnly });
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) imports.push({ value: node.arguments[0].text, typeOnly: false });
    ts.forEachChild(node, visit);
  }
  visit(source);
  const path = relative(root, file).replaceAll("\\", "/");
  const layer = (value: string) => value.startsWith("@/") ? value.slice(2) : value.startsWith(".") ? relative(root, resolve(dirname(file), value)).replaceAll("\\", "/") : value;
  return { path, text, imports: imports.map((item) => ({ ...item, target: layer(item.value) })) };
});

describe("アーキテクチャ境界（NFR-007/008、AT-10の保守基盤）", () => {
  it("資料の入口・構成図・コード索引が存在するファイルを案内する", () => {
    for (const document of ["README.md", "docs/index.md", "docs/architecture.md", "docs/code-map.md", "docs/adr/0002-code-organization.md"]) {
      const text = readFileSync(document, "utf8");
      for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
        const target = match[1].split("#")[0];
        if (!target || /^https?:/.test(target)) continue;
        expect(existsSync(resolve(dirname(document), target)), `${document}: ${target}`).toBe(true);
      }
    }
  });
  it("業務ルールと契約は画面・フレームワーク・DBから独立する", () => {
    for (const file of files.filter((file) => file.path.startsWith("domain/"))) {
      for (const dependency of file.imports) expect(dependency.target, `${file.path}: ${dependency.value}`).toMatch(/^domain\//);
    }
  });

  it("DB・HTTP接続は業務契約と同じ接続層だけに依存し、接続実装の選択をcontainerへ集める", () => {
    for (const file of files.filter((file) => file.path.startsWith("infrastructure/"))) {
      for (const dependency of file.imports.filter((item) => item.value.startsWith("@/") || item.value.startsWith("."))) expect(dependency.target, `${file.path}: ${dependency.value}`).toMatch(/^(domain|infrastructure)\//);
    }
    for (const file of files.filter((file) => /^(server|app)\//.test(file.path) && file.path !== "server/container.ts")) {
      for (const dependency of file.imports) {
        expect(dependency.target, `${file.path}: ${dependency.value}`).not.toMatch(/^infrastructure\//);
        if (file.path !== "app/api/mock/route.ts") expect(dependency.target, `${file.path}: ${dependency.value}`).not.toMatch(/^mocks\//);
      }
    }
  });

  it("ブラウザの画面はServer Actionsだけをサーバー入口として使用する", () => {
    for (const file of files.filter((file) => /^\s*["']use client["']/.test(file.text))) {
      for (const dependency of file.imports.filter((item) => !item.typeOnly)) {
        if (dependency.target.startsWith("server/")) expect(dependency.target, file.path).toMatch(/^server\/actions\//);
        if (dependency.target.startsWith("infrastructure/")) expect(dependency.target, file.path).toBe("infrastructure/supabase/clients/browser");
      }
    }
    for (const file of files.filter((file) => file.path.startsWith("server/actions/"))) expect(file.text, file.path).toMatch(/^\s*["']use server["']/);
  });

  it("旧lib参照を残さず、UI設定は本番接続やデモデータを読み込まない", () => {
    for (const file of files) {
      for (const dependency of file.imports) expect(dependency.target, file.path).not.toMatch(/^lib\//);
      if (file.path.startsWith("config/")) for (const dependency of file.imports) expect(dependency.target, file.path).not.toMatch(/^(server|infrastructure|mocks)\//);
    }
  });
});
