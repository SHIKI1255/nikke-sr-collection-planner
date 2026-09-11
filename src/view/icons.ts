import { element } from "./dom";
export type Mark = "circle" | "triangle" | "cross";
const NS = "http://www.w3.org/2000/svg";
/** One geometry source for the legend, on-screen tables, and print. */
const shapes: Record<Mark, { tag: "circle" | "path"; attributes: Record<string, string> }> = {
  circle: { tag: "circle", attributes: { cx: "12", cy: "12", r: "9.5" } },
  triangle: { tag: "path", attributes: { d: "M12 2.5L22 21H2Z", "stroke-linejoin": "round" } },
  cross: { tag: "path", attributes: { d: "M4 4L20 20M20 4L4 20", "stroke-linecap": "round" } },
};
export function createMark(mark: Mark, title?: string) {
  const container = element("span", `mark ${mark}`);
  if (title) {
    container.setAttribute("role", "img");
    container.setAttribute("aria-label", title);
    container.title = title;
  } else container.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "status-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const shape = document.createElementNS(NS, shapes[mark].tag);
  for (const [name, value] of Object.entries({ ...shapes[mark].attributes, fill: "none", stroke: "currentColor", "stroke-width": "3" })) shape.setAttribute(name, value);
  svg.append(shape);
  container.append(svg);
  return container;
}
export function renderLegend() {
  document.querySelectorAll<HTMLElement>("[data-legend-mark]").forEach((placeholder) => {
    placeholder.replaceWith(createMark(placeholder.dataset.legendMark as Mark));
  });
}
