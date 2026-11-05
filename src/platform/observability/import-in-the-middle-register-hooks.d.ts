// NodeNext pairs .mjs with .d.mts; these signatures mirror import-in-the-middle 3.5.3 register-hooks.d.ts.
declare module "import-in-the-middle/register-hooks.mjs" {
  export interface RegisterHooksOptions {
    include?: (string | RegExp)[];
    exclude?: (string | RegExp)[];
    disableCjsSourceStripping?: boolean;
  }
  export function register(options?: RegisterHooksOptions): void;
  export function supportsSyncHooks(): boolean;
}
