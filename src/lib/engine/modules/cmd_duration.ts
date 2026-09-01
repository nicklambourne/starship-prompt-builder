import { type ModuleDefinition, optBool, optNumber } from "./types";

/** Port of starship's `render_time`. */
function renderTime(rawMillis: number, showMillis: boolean): string {
  if (rawMillis === 0 && showMillis) return "0ms";
  if (rawMillis < 1000 && !showMillis) return "0s";

  const millis = rawMillis % 1000;
  const rawSeconds = Math.floor(rawMillis / 1000);
  const seconds = rawSeconds % 60;
  const rawMinutes = Math.floor(rawSeconds / 60);
  const minutes = rawMinutes % 60;
  const rawHours = Math.floor(rawMinutes / 60);
  const hours = rawHours % 24;
  const days = Math.floor(rawHours / 24);

  const components: [number, string][] = [
    [days, "d"],
    [hours, "h"],
    [minutes, "m"],
    [seconds, "s"],
  ];

  // Components are concatenated from the first non-zero one onwards.
  const result = components.reduce(
    (acc, [value, suffix]) => (value === 0 && acc === "" ? acc : `${acc}${value}${suffix}`),
    "",
  );

  return showMillis ? `${result}${millis}ms` : result;
}

export const cmd_duration: ModuleDefinition = {
  name: "cmd_duration",
  defaults: {
    min_time: 2_000,
    format: "took [$duration]($style) ",
    style: "yellow bold",
    show_milliseconds: false,
    disabled: false,
    show_notifications: false,
    min_time_to_notify: 45_000,
    notification_timeout: undefined,
  },
  evaluate(options, ctx) {
    const minTime = optNumber(options, "min_time", 2_000);
    if (minTime < 0) return null;

    const elapsed = ctx.scenario.cmdDurationMs;
    if (elapsed < minTime) return null;

    return {
      variables: { duration: renderTime(elapsed, optBool(options, "show_milliseconds")) },
    };
  },
};
