let loaderOrb: DOMRect | null = null;

export function rememberLoaderOrb(rect: DOMRect | null) {
  loaderOrb = rect;
}

export function takeLoaderOrb(): DOMRect | null {
  const rect = loaderOrb;
  loaderOrb = null;
  return rect;
}
