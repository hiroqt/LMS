/** "Good morning" before noon, "Good afternoon" until 6 PM, then "Good evening". Every role's dashboard heading (D-066). */
export function greeting(now: number): string {
  const hour = new Date(now).getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
