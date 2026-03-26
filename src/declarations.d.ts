// CSS Module type declarations — tells TypeScript that *.module.css imports
// return a plain object mapping class names to their scoped string values.
declare module "*.module.css" {
  const styles: { readonly [className: string]: string };
  export default styles;
}
