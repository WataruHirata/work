"use client";

import { useActionState, useState, type ReactNode } from "react";
import { executeOperation, saveMaster, importUserCsv } from "@/server/actions/workspace";
import { masterFields, type WorkspaceField } from "@/config/ui";
import type { ActionResult, DataRecord, Resource } from "@/domain/contracts";

export type Lookups = Partial<Record<Resource, DataRecord[]>>;
export function Feedback({ state }: { state: ActionResult }) {
  return (
    <>
      {state.error && (
        <p className="login-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && <p role="status">{state.success}</p>}
      {state.secret && (
        <p className="device-secret">
          <code>{state.secret}</code>
        </p>
      )}
    </>
  );
}
export function Fields({
  fields,
  values = {},
  lookups = {},
}: {
  fields: readonly WorkspaceField[];
  values?: Record<string, unknown>;
  lookups?: Lookups;
}) {
  return (
    <div className="workspace-fields">
      {fields.map((field) => {
        const options =
          field.options ??
          (field.lookup
            ? (lookups[field.lookup] ?? []).map((row) => ({
                value: row.id,
                label: `${row.code ?? row.employee_code ?? ""} ${row.name ?? row.display_name ?? row.id}`,
              }))
            : undefined);
        const raw = values[field.key];
        const value = raw == null ? (field.key === "active" ? "true" : "") : String(raw);
        return (
          <label className="field" key={field.key}>
            <span>
              {field.label}
              {field.required ? " *" : ""}
            </span>
            {options ? (
              <select name={field.key} defaultValue={value} required={field.required}>
                <option value="">選択してください</option>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={field.key}
                type={field.type ?? "text"}
                defaultValue={value}
                required={field.required}
                min={field.min}
                max={field.max}
                maxLength={field.type === "password" ? 128 : 2000}
                autoComplete={field.type === "password" ? "new-password" : undefined}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
export function OperationForm({
  operation,
  label,
  children,
  fields = [],
  lookups,
  values,
  confirm,
}: {
  operation: string;
  label: string;
  children?: ReactNode;
  fields?: readonly WorkspaceField[];
  lookups?: Lookups;
  values?: Record<string, unknown>;
  confirm?: string;
}) {
  const [state, action, pending] = useActionState(executeOperation.bind(null, operation), {});
  return (
    <form action={action} className="workspace-form">
      <Fields fields={fields} lookups={lookups} values={values} />
      {children}
      {confirm && (
        <label>
          <input type="checkbox" name="confirm" value="true" required /> {confirm}
        </label>
      )}
      <button type="submit" className="primary-button" disabled={pending}>
        {pending ? "保存中…" : label}
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function MasterForm({
  resource,
  row,
  lookups,
}: {
  resource: Resource;
  row?: DataRecord;
  lookups: Lookups;
}) {
  const [state, action, pending] = useActionState(saveMaster.bind(null, resource), {});
  return (
    <form action={action} className="workspace-form">
      {row && (
        <>
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="version" value={String(row.updated_at)} />
        </>
      )}
      <Fields fields={masterFields[resource] ?? []} values={row} lookups={lookups} />
      <button type="submit" className="primary-button" disabled={pending}>
        {pending ? "保存中…" : row ? "変更を保存" : "新規登録"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function OrderForm({ lookups, requestId }: { lookups: Lookups; requestId: string }) {
  const [state, action, pending] = useActionState(executeOperation.bind(null, "createOrder"), {});
  const [store, setStore] = useState("");
  const [items, setItems] = useState([{ productId: "", quantity: "1" }]);
  return (
    <form action={action} className="workspace-form">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <label className="field">
        <span>店舗</span>
        <select
          name="storeId"
          value={store}
          onChange={(event) => setStore(event.target.value)}
          required
        >
          <option value="">選択してください</option>
          {lookups.stores?.map((row) => (
            <option key={row.id} value={row.id}>
              {String(row.name)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>担当売場</span>
        <select name="departmentId" required key={store}>
          <option value="">選択してください</option>
          {lookups.departments
            ?.filter((row) => row.store_id === store)
            .map((row) => (
              <option key={row.id} value={row.id}>
                {String(row.name)}
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        <span>希望納期</span>
        <input type="date" name="deliveryDate" required />
      </label>
      {items.map((item, index) => (
        <div className="workspace-fields" key={index}>
          <label className="field">
            <span>商品 {index + 1}</span>
            <select
              value={item.productId}
              onChange={(event) =>
                setItems((current) =>
                  current.map((line, i) =>
                    i === index ? { ...line, productId: event.target.value } : line,
                  ),
                )
              }
              required
            >
              <option value="">選択してください</option>
              {lookups.products
                ?.filter((row) => row.active)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {String(row.code)} {String(row.name)}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>数量</span>
            <input
              type="number"
              min={1}
              max={99999}
              required
              value={item.quantity}
              onChange={(event) =>
                setItems((current) =>
                  current.map((line, i) =>
                    i === index ? { ...line, quantity: event.target.value } : line,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            className="ghost-button"
            disabled={items.length === 1}
            onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
          >
            行を削除
          </button>
        </div>
      ))}
      <div className="button-row">
        <button
          type="button"
          className="ghost-button"
          onClick={() => setItems((current) => [...current, { productId: "", quantity: "1" }])}
        >
          商品を追加
        </button>
        <button
          className="primary-button"
          type="submit"
          disabled={pending || Boolean(state.success)}
        >
          {pending ? "保存中…" : "発注を保存して連携待ちへ"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
export function UserImportForm() {
  const [state, action, pending] = useActionState(importUserCsv, {});
  return (
    <form action={action} className="workspace-form">
      <label className="field">
        <span>利用者CSV（既存認証IDに対応する社員情報を登録・更新）</span>
        <input type="file" accept=".csv" name="file" required />
      </label>
      <p className="muted">
        列：id,employee_code,display_name,affiliation,active。パスワードとロールはCSVに含めません。
      </p>
      <button type="submit" className="primary-button" disabled={pending}>
        {pending ? "処理中…" : "CSVを一括反映"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
