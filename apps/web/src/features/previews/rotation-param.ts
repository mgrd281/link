/**
 * The address parameter that carries a page's clip rotation from one visit to the next
 * (`?clip=<key>`, ./rotation.ts). Its own module, so the browser's part (RotationAddress) does not
 * pull in the motion library.
 */
export const ROTATION_PARAM = "clip";
