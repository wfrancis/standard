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
  status: "matched" | "unmatched" | "warning";
  note: string;
}

export function crossReferenceScope(
  bidSummary: BidSummary,
  specExtractions: SpecExtraction[]
): ScopeMatch[] {
  const results: ScopeMatch[] = [];
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
        results.push({
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
      results.push({
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
    results.push({
      scopeItem: product.sectionTitle,
      matchedProduct: product.sectionTitle,
      matchedCsi: product.csiSection,
      status: "warning",
      note: `${product.csiSection} ${product.sectionTitle} in specs but not in bid scope`,
    });
  }

  return results;
}
