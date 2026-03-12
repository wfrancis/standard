import type { BidSummary } from "@/lib/schemas/bid";
import type { SpecExtraction } from "@/lib/schemas/spec";

// Maps common flooring type names to CSI section prefixes
const FLOORING_TO_CSI: [RegExp, string, string][] = [
  [/carpet\s*tile/i, "09 68 13", "Tile Carpeting"],
  [/carpet/i, "09 68", "Carpeting"],
  [/lvt|luxury\s*vinyl\s*tile/i, "09 65 19", "Resilient Tile Flooring"],
  [/vct|vinyl\s*composition/i, "09 65 19", "Resilient Tile Flooring"],
  [/sheet\s*vinyl/i, "09 65 16", "Resilient Sheet Flooring"],
  [/resilient|vinyl/i, "09 65", "Resilient Flooring"],
  [/rubber/i, "09 65", "Resilient Flooring"],
  [/ceramic|porcelain/i, "09 30", "Tiling"],
  [/tile/i, "09 30", "Tiling"],
  [/terrazzo/i, "09 66", "Terrazzo"],
  [/epoxy|coating/i, "09 96", "High-Performance Coatings"],
  [/wood|hardwood/i, "09 64", "Wood Flooring"],
  [/masonry/i, "09 63", "Masonry Flooring"],
  [/base|cove\s*base/i, "09 65 13", "Resilient Base and Accessories"],
];

export interface ScopeMatch {
  scopeItem: string;
  matchedProduct: string | null;
  matchedCsi: string | null;
  status: "matched" | "unmatched";
  note: string;
}

export interface SpecGapItem {
  productTitle: string;
  csiSection: string;
  impact: string;
}

export interface CrossReferenceResult {
  scopeMatches: ScopeMatch[];
  specGaps: SpecGapItem[];
}

function classifyGapImpact(csiSection: string): string {
  if (csiSection.startsWith("09 66")) return "High-cost scope gap — verify exclusion";
  if (csiSection.startsWith("09 96")) return "High-cost scope gap — verify exclusion";
  if (csiSection.startsWith("09 65 13")) return "Common add-on — confirm if in base bid";
  return "Potential change order";
}

export function crossReferenceScope(
  bidSummary: BidSummary,
  specExtractions: SpecExtraction[]
): CrossReferenceResult {
  const scopeMatches: ScopeMatch[] = [];
  const specGaps: SpecGapItem[] = [];
  const allProducts = specExtractions.flatMap((s) => s.products);
  const matchedProductIndices = new Set<number>();

  // For each scope item, try to find a matching spec product
  for (const scope of bidSummary.scope) {
    const flooringType = scope.flooringType;
    let matched = false;

    // Try each mapping
    for (const [pattern, csiPrefix] of FLOORING_TO_CSI) {
      if (!pattern.test(flooringType)) continue;

      // Find a product with matching CSI section
      const productIdx = allProducts.findIndex(
        (p, idx) => !matchedProductIndices.has(idx) && p.csiSection.startsWith(csiPrefix)
      );

      if (productIdx >= 0) {
        const product = allProducts[productIdx];
        matchedProductIndices.add(productIdx);
        scopeMatches.push({
          scopeItem: flooringType,
          matchedProduct: product.sectionTitle,
          matchedCsi: product.csiSection,
          status: "matched",
          note: `${flooringType} matched to ${product.csiSection} ${product.sectionTitle}`,
        });
        matched = true;
        break;
      }
    }

    if (!matched) {
      scopeMatches.push({
        scopeItem: flooringType,
        matchedProduct: null,
        matchedCsi: null,
        status: "unmatched",
        note: `${flooringType} in bid scope but no matching spec section found`,
      });
    }
  }

  // Check for spec products not in bid scope
  for (let i = 0; i < allProducts.length; i++) {
    if (matchedProductIndices.has(i)) continue;
    const product = allProducts[i];
    specGaps.push({
      productTitle: product.sectionTitle,
      csiSection: product.csiSection,
      impact: classifyGapImpact(product.csiSection),
    });
  }

  return { scopeMatches, specGaps };
}

// SF Reconciliation: compare bid scope quantities to drawing sheet counts
export interface SFReconciliationItem {
  flooringType: string;
  scopeSF: string | null;
  relevantSheetCount: number;
  matchingSheetIds: string[];
  plausibility: "ok" | "review";
}

export function buildSFReconciliation(
  bidSummary: BidSummary,
  drawings: Array<{ sheetId: string; relevanceToFlooring: string; flooringNotes: string | null }>
): SFReconciliationItem[] {
  const relevantDrawings = drawings.filter(
    (d) => d.relevanceToFlooring === "high" || d.relevanceToFlooring === "medium"
  );

  return bidSummary.scope.map((scope) => {
    // Build keywords from the flooring type
    const keywords: RegExp[] = [];
    for (const [pattern] of FLOORING_TO_CSI) {
      if (pattern.test(scope.flooringType)) {
        // Extract core words from the flooring type for note matching
        const words = scope.flooringType.toLowerCase().split(/\s+/);
        for (const w of words) {
          if (w.length > 2) keywords.push(new RegExp(w, "i"));
        }
        break;
      }
    }

    // If no CSI match, use raw flooring type words
    if (keywords.length === 0) {
      const words = scope.flooringType.toLowerCase().split(/\s+/);
      for (const w of words) {
        if (w.length > 2) keywords.push(new RegExp(w, "i"));
      }
    }

    // Find matching sheets
    const matching = relevantDrawings.filter((d) => {
      if (!d.flooringNotes) return false;
      return keywords.some((kw) => kw.test(d.flooringNotes!));
    });

    // Plausibility heuristic
    let plausibility: "ok" | "review" = "ok";
    if (scope.approxSF && matching.length === 0) {
      plausibility = "review";
    } else if (scope.approxSF) {
      const sfNum = parseInt(scope.approxSF.replace(/[^0-9]/g, ""), 10);
      if (sfNum > 10000 && matching.length <= 1) {
        plausibility = "review";
      }
    }

    return {
      flooringType: scope.flooringType,
      scopeSF: scope.approxSF || null,
      relevantSheetCount: matching.length,
      matchingSheetIds: matching.map((m) => m.sheetId),
      plausibility,
    };
  });
}
