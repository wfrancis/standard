import type { BidSummary } from "@/lib/schemas/bid";

export function formatBidSummaryText(bid: BidSummary): string {
  const lines: string[] = [];

  lines.push(`PROJECT: ${bid.projectName}`);
  if (bid.projectLocation) lines.push(`Location: ${bid.projectLocation}`);
  if (bid.owner) lines.push(`Owner: ${bid.owner}`);
  lines.push("");

  lines.push(`GC: ${bid.gcName}`);
  if (bid.gcEstimator) lines.push(`Estimator: ${bid.gcEstimator}`);
  if (bid.gcEmail) lines.push(`Email: ${bid.gcEmail}`);
  if (bid.gcPhone) lines.push(`Phone: ${bid.gcPhone}`);
  lines.push("");

  lines.push(`BID DATE: ${bid.bidDate}${bid.bidTime ? ` at ${bid.bidTime}` : ""}`);
  if (bid.preBidDate) {
    lines.push(`Pre-Bid: ${bid.preBidDate}${bid.preBidMandatory ? " (MANDATORY)" : ""}`);
  }
  if (bid.prevailingWage !== null && bid.prevailingWage !== undefined) {
    lines.push(`Prevailing Wage: ${bid.prevailingWage ? "Yes" : "No"}`);
  }
  lines.push(`Recommendation: ${bid.recommendation.replaceAll("_", " ")}`);
  lines.push("");

  if (bid.scope.length > 0) {
    lines.push("SCOPE:");
    for (const s of bid.scope) {
      const parts = [s.flooringType];
      if (s.approxSF) parts.push(`~${s.approxSF} SF`);
      if (s.product) parts.push(s.product);
      if (s.manufacturer) parts.push(`(${s.manufacturer})`);
      lines.push(`  - ${parts.join(" | ")}`);
    }
    lines.push("");
  }

  if (bid.alternates && bid.alternates.length > 0) {
    lines.push("ALTERNATES:");
    bid.alternates.forEach((a, i) => {
      lines.push(`  Alt ${a.number || i + 1}: ${a.description}${a.estimatedSF ? ` (${a.estimatedSF})` : ""}`);
    });
    lines.push("");
  }

  if (bid.keyNotes.length > 0) {
    lines.push("KEY NOTES:");
    bid.keyNotes.forEach((n) => lines.push(`  - ${n}`));
    lines.push("");
  }

  if (bid.risks.length > 0) {
    lines.push("RISKS:");
    bid.risks.forEach((r) => lines.push(`  ! ${r}`));
    lines.push("");
  }

  if (bid.addenda && bid.addenda.length > 0) {
    lines.push("ADDENDA:");
    bid.addenda.forEach((a) => lines.push(`  - ${a}`));
    lines.push("");
  }

  if (bid.missingDocuments.length > 0) {
    lines.push("MISSING DOCUMENTS:");
    bid.missingDocuments.forEach((d) => lines.push(`  - ${d}`));
    lines.push("");
  }

  if (bid.moistureResponsibility) {
    lines.push(`MOISTURE: ${bid.moistureResponsibility}`);
  }

  return lines.join("\n").trim();
}
