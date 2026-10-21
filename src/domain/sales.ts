type BusinessDateInput = {
  timestamp: string;
  timeZone: string;
  businessDayStartsAt: string;
};

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function getBusinessDate({
  timestamp,
  timeZone,
  businessDayStartsAt,
}: BusinessDateInput): string {
  const instant = new Date(timestamp);
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError("timestamp must be a valid ISO date");
  }
  if (!/^\d{2}:\d{2}$/.test(businessDayStartsAt)) {
    throw new RangeError("businessDayStartsAt must use HH:mm");
  }

  const [startHour, startMinute] = businessDayStartsAt.split(":").map(Number);
  if (startHour > 23 || startMinute > 59) {
    throw new RangeError("businessDayStartsAt must be a valid local time");
  }

  const local = dateParts(instant, timeZone);
  const localMinutes = Number(local.hour) * 60 + Number(local.minute);
  if (localMinutes >= startHour * 60 + startMinute) {
    return `${local.year}-${local.month}-${local.day}`;
  }

  const previousDay = new Date(
    Date.UTC(
      Number(local.year),
      Number(local.month) - 1,
      Number(local.day) - 1,
    ),
  );
  return [
    previousDay.getUTCFullYear(),
    String(previousDay.getUTCMonth() + 1).padStart(2, "0"),
    String(previousDay.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function calculateTaxIncludedTotal(
  lines: ReadonlyArray<{ unitPrice: number; quantity: number }>,
  taxRatePercent: number,
): number {
  if (taxRatePercent !== 8 && taxRatePercent !== 10) {
    throw new RangeError("taxRatePercent must be 8 or 10");
  }

  const subtotal = lines.reduce((sum, line) => {
    if (
      !Number.isSafeInteger(line.unitPrice) ||
      line.unitPrice < 0 ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 0
    ) {
      throw new RangeError(
        "unitPrice and quantity must be non-negative integers",
      );
    }
    return sum + line.unitPrice * line.quantity;
  }, 0);

  if (!Number.isSafeInteger(subtotal)) {
    throw new RangeError("subtotal exceeds the supported safe integer range");
  }

  const total = (BigInt(subtotal) * BigInt(100 + taxRatePercent)) / BigInt(100);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(
      "tax-included total exceeds the supported safe integer range",
    );
  }

  return Number(total);
}
