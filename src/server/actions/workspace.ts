"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { identity, repository } from "@/server/container";
import { activeSession, requireRoles } from "@/server/auth/session";
import { date, integer, japanDateTime, parseMaster, text, uuid } from "@/server/validation";
import { runConfiguredIntegrations } from "@/server/integrations/run";
import { deviceToken } from "@/server/auth/store-context";
import type { ActionResult, Json, Resource } from "@/domain/contracts";

function message(error: unknown) {
  return error instanceof Error ? error.message : "処理を完了できませんでした。";
}
function invalidate() {
  revalidatePath("/admin", "layout");
  revalidatePath("/store", "layout");
}

export async function saveMaster(
  resource: Resource,
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    if (!["products", "stores", "users", "announcements"].includes(resource))
      throw new Error("編集できないデータです。");
    await requireRoles(resource === "products" ? ["product_office"] : ["information_systems"]);
    const values = parseMaster(resource, data);
    const id = data.get("id") ? uuid(data.get("id")) : undefined;
    const version = id ? text(data.get("version"), 80) : undefined;
    await repository().save(
      resource as "products" | "stores" | "users" | "announcements",
      values,
      id,
      version,
    );
    invalidate();
    return { success: "保存しました。" };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function executeOperation(
  operation: string,
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    if (operation === "createOrder") {
      const session = await identity().session();
      if (!session?.active) throw new Error("ログインしてください。");
      if (session.mustChangePassword) throw new Error("パスワードを変更してください。");
    } else if (operation !== "requestCorrection") {
      await activeSession();
    }
    const repo = repository();
    let orderTransferred = false;
    switch (operation) {
      case "confirmSales":
        await requireRoles(["store_manager"]);
        await repo.execute("confirmSales", {
          p_sales_day_id: uuid(data.get("salesDayId")),
        });
        break;
      case "requestCorrection": {
        if (data.get("confirm") !== "true") throw new Error("変更前後を確認してください。");
        const salesDayId = uuid(data.get("salesDayId"));
        const reason = text(data.get("reason"), 500);
        const amount = integer(data.get("amount"));
        const session = await identity().session();
        const token = await deviceToken();
        if (token) {
          await repo.storeDeviceRequestCorrection(token, salesDayId, reason, amount);
        } else if (session?.active && session.roles.includes("store_manager")) {
          await repo.execute("requestCorrection", {
            p_sales_day_id: salesDayId,
            p_reason: reason,
            p_after_amount_yen: amount,
          });
        } else {
          throw new Error("店舗端末を登録してください。");
        }
        break;
      }
      case "approveCorrection": {
        await requireRoles(["area_manager", "store_operations"]);
        const approved = data.get("approved");
        if (approved !== "true" && approved !== "false")
          throw new Error("承認または差戻しを選択してください。");
        const comment = String(data.get("comment") ?? "").trim();
        if (comment.length > 500 || (approved === "false" && !comment))
          throw new Error("差戻し理由を500文字以内で入力してください。");
        await repo.execute("approveCorrection", {
          p_correction_id: uuid(data.get("correctionId")),
          p_approved: approved === "true",
          p_comment: comment || null,
        });
        break;
      }
      case "finalizeMonth": {
        await requireRoles(["accounting"]);
        const month = String(data.get("month"));
        if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("対象年月を指定してください。");
        if (data.get("confirm") !== "true")
          throw new Error("月次確定後は変更できないことを確認してください。");
        await repo.execute("finalizeMonth", {
          p_store_id: uuid(data.get("storeId")),
          p_month_start: date(`${month}-01`),
        });
        break;
      }
      case "createOrder": {
        const raw: unknown = JSON.parse(String(data.get("items")));
        if (!Array.isArray(raw) || raw.length < 1 || raw.length > 500)
          throw new Error("発注商品を指定してください。");
        const items = raw.map((line: { productId?: unknown; quantity?: unknown }) => ({
          product_id: uuid(line?.productId),
          quantity: integer(line?.quantity, 1, 99999),
        }));
        if (new Set(items.map((line) => line.product_id)).size !== items.length)
          throw new Error("同じ商品は一行にまとめてください。");
        await repo.execute("createOrder", {
          p_store_id: uuid(data.get("storeId")),
          p_department_id: uuid(data.get("departmentId")),
          p_delivery_date: date(data.get("deliveryDate")),
          p_items: items,
          p_request_id: uuid(data.get("requestId")),
        });
        try {
          const result = await runConfiguredIntegrations();
          orderTransferred = result.completed > 0;
        } catch {
          orderTransferred = false;
        }
        break;
      }
      case "markRead":
        await repo.execute("markRead", {
          p_notification_id: uuid(data.get("notificationId")),
        });
        break;
      case "assignRole": {
        await requireRoles(["information_systems"]);
        const role = text(data.get("role"));
        if (
          ![
            "information_systems",
            "product_office",
            "store_operations",
            "area_manager",
            "accounting",
            "store_manager",
            "department_lead",
            "staff",
          ].includes(role)
        )
          throw new Error("ロールを選択してください。");
        await repo.execute("assignRole", {
          p_user_id: uuid(data.get("userId")),
          p_role: role,
          p_area_id: data.get("areaId") ? uuid(data.get("areaId")) : null,
          p_store_id: data.get("storeId") ? uuid(data.get("storeId")) : null,
          p_department_id: data.get("departmentId") ? uuid(data.get("departmentId")) : null,
        });
        break;
      }
      case "revokeRole":
        await requireRoles(["information_systems"]);
        await repo.execute("revokeRole", {
          p_assignment_id: uuid(data.get("assignmentId")),
        });
        break;
      case "retryJob":
        await requireRoles(["information_systems", "product_office"]);
        await repo.execute("retryJob", { p_job_id: uuid(data.get("jobId")) });
        break;
      case "registerDevice": {
        await requireRoles(["information_systems"]);
        const token = randomBytes(32).toString("hex");
        await repo.execute("registerDevice", {
          p_store_id: uuid(data.get("storeId")),
          p_name: text(data.get("name"), 100),
          p_token: token,
        });
        invalidate();
        return {
          success:
            "端末を登録しました。対象PCの「店舗端末の接続」で下記のコードを入力してください。この画面を閉じるとコードは再表示できません。",
          secret: token,
        };
      }
      case "disableDevice":
        await requireRoles(["information_systems"]);
        await repo.execute("disableDevice", {
          p_device_id: uuid(data.get("deviceId")),
        });
        break;
      case "verifyProduct":
        await requireRoles(["product_office", "information_systems"]);
        await repo.execute("changeCampaignEligibility", {
          p_campaign_item_id: uuid(data.get("itemId")),
        });
        break;
      case "createUser": {
        await requireRoles(["information_systems"]);
        const email = text(data.get("email"), 254);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          throw new Error("メールアドレスを確認してください。");
        const password = text(data.get("password"), 128);
        if (password.length < 12) throw new Error("初回パスワードは12文字以上で指定してください。");
        await identity().provisionUser(
          email,
          password,
          text(data.get("employeeCode"), 80),
          text(data.get("displayName"), 200),
        );
        break;
      }
      case "editCampaign": {
        await requireRoles(["product_office", "information_systems"]);
        const prices = [...data.entries()]
          .filter(([key]) => key.startsWith("price:"))
          .map(([key, value]) => ({
            id: uuid(key.slice(6)),
            price_yen: integer(value, 0, 2147483647),
          }));
        await repo.execute("editCampaign", {
          p_campaign_id: uuid(data.get("campaignId")),
          p_expected_version: text(data.get("version"), 80),
          p_name: text(data.get("name"), 200),
          p_starts_at: japanDateTime(data.get("startsAt")),
          p_ends_at: japanDateTime(data.get("endsAt")),
          p_prices: prices,
        });
        break;
      }
      default:
        throw new Error("未対応の操作です。");
    }
    invalidate();
    return {
      success:
        operation === "requestCorrection"
          ? "修正依頼を受け付けました。承認担当へ通知し、最終承認後に売上へ反映します。"
          : operation === "approveCorrection"
            ? "決定を保存し、次の承認担当または申請店舗へ通知しました。"
            : operation === "createUser"
              ? "利用者を登録しました。続けてロールと担当範囲を割り当ててください。"
              : operation === "createOrder"
                ? orderTransferred
                  ? "発注を登録し、基幹システムが受け付けました。"
                  : "発注を登録しました。基幹システムへの送信は連携待ちです。"
                : "処理を保存しました。",
    };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function importUserCsv(_state: ActionResult, data: FormData): Promise<ActionResult> {
  // Imported lazily so credential/CSV parsing does not enter the client bundle.
  try {
    await requireRoles(["information_systems"]);
    const { parseCsv } = await import("@/server/imports/canonical-import");
    const file = data.get("file");
    if (!(file instanceof File) || file.size > 1_000_000)
      throw new Error("1MB以内のCSVを選択してください。");
    const rows = parseCsv(await file.text());
    if (!rows.length || rows.length > 500) throw new Error("1～500行のCSVを指定してください。");
    const items: Json[] = rows.map((row) => {
      if (row.active !== "true" && row.active !== "false")
        throw new Error("active列はtrueまたはfalseで指定してください。");
      return {
        id: uuid(row.id),
        employee_code: text(row.employee_code, 80),
        display_name: text(row.display_name, 200),
        affiliation: row.affiliation || null,
        active: row.active === "true",
      };
    });
    const { importProfiles } = await import("@/server/imports/profile-import");
    await importProfiles(items);
    invalidate();
    return { success: `${items.length}件の利用者情報を一括更新しました。` };
  } catch (error) {
    return { error: message(error) };
  }
}
