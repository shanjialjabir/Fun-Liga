export const ACCENT_COLOR = "#ADEC25";

export const TEAM_COLORS = [
  ACCENT_COLOR,
  "#35B9FF",
  "#A875FF",
  "#FF961F",
  "#16DFB0",
  "#FF4F88",
];

const legacyTeamColors = [
  "#BCE875",
  "#78BCEC",
  "#D4A5EC",
  "#FFBD7B",
  "#82D6BC",
  "#F28EA7",
];

// Apply the current palette to existing teams without modifying saved data.
export function displayTeamColor(color?: string): string {
  if (!color) return ACCENT_COLOR;
  const index = legacyTeamColors.indexOf(color.toUpperCase());
  return index < 0 ? color : TEAM_COLORS[index];
}
