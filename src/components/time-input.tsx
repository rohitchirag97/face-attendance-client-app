import React from "react";
import { Field } from "@/components/form-kit";
import { inputClass } from "@/lib/form-utils";

const hours = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

/** 12-hour time picker with an explicit AM/PM selector. Value is "HH:MM" in 24-hour form. */
export const TimeInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => {
  const [hour24, minute] = value.split(":").map(Number);
  const hour12 = hour24 % 12 || 12;
  const period = hour24 >= 12 ? "PM" : "AM";
  const setTime = (hour: number, minuteValue: number, periodValue: string) => {
    const hourValue = (hour % 12) + (periodValue === "PM" ? 12 : 0);
    onChange(`${String(hourValue).padStart(2, "0")}:${String(minuteValue).padStart(2, "0")}`);
  };

  return (
    <Field label={label}>
      {(id) => (
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <select
            id={id}
            aria-label={`${label} hour`}
            value={String(hour12).padStart(2, "0")}
            onChange={(event) => setTime(Number(event.target.value), minute, period)}
            className={inputClass}
          >
            {hours.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
          </select>
          <select
            aria-label={`${label} minute`}
            value={String(minute).padStart(2, "0")}
            onChange={(event) => setTime(hour12, Number(event.target.value), period)}
            className={inputClass}
          >
            {minutes.map((minuteOption) => <option key={minuteOption} value={minuteOption}>{minuteOption}</option>)}
          </select>
          <select
            aria-label={`${label} AM or PM`}
            value={period}
            onChange={(event) => setTime(hour12, minute, event.target.value)}
            className={inputClass}
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      )}
    </Field>
  );
};
