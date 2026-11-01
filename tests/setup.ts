import { afterEach } from "vitest";

// jsdom does not implement <dialog>.showModal()/close(); give it a minimal,
// behaviour-faithful stand-in so components using the native dialog can be tested.
if (typeof window !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());

  const proto = window.HTMLDialogElement?.prototype;
  if (proto && !proto.showModal) {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    proto.close = function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
}
