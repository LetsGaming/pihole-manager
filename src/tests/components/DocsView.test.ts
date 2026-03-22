/**
 * Component Tests — DocsView
 *
 * Tests documentation rendering: all major sections present,
 * navigation links, code blocks, and keyboard-accessible anchors.
 */

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import DocsView from "@/views/DocsView.vue";

function createWrapper() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(DocsView, {
    global: {
      plugins: [pinia],
      stubs: {
        "ion-page": { template: '<div class="ion-page"><slot /></div>' },
        "ion-header": { template: "<div><slot /></div>" },
        "ion-toolbar": { template: "<div><slot /></div>" },
        "ion-content": { template: '<div class="ion-content"><slot /></div>' },
        "ion-buttons": { template: "<div><slot /></div>" },
        "ion-menu-button": { template: "<button />" },
        "ion-icon": { template: "<span />" },
      },
    },
  });
}

describe("DocsView", () => {
  // ─── Page renders ─────────────────────────────────────────────────────────
  it("renders without errors", () => {
    expect(() => createWrapper()).not.toThrow();
  });

  it("contains the app name in the heading", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toMatch(/orbital/i);
  });

  // ─── Major sections ───────────────────────────────────────────────────────
  it("contains Getting Started section", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toMatch(/getting started/i);
  });

  it("contains instance management section", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toMatch(/instance/i);
  });

  it("contains query log section", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toMatch(/query log/i);
  });

  it("contains blocking control section", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toMatch(/block/i);
  });

  it("contains hardware section", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toMatch(/hardware/i);
  });

  it("contains API token instructions", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toMatch(/api token/i);
  });

  // ─── Navigation ───────────────────────────────────────────────────────────
  it("has a sidebar navigation with links", () => {
    const wrapper = createWrapper();
    // nav links should be anchor elements
    const links = wrapper.findAll("a");
    expect(links.length).toBeGreaterThan(0);
  });

  it("nav links use hash anchors", () => {
    const wrapper = createWrapper();
    const links = wrapper.findAll("a");
    const hashLinks = links.filter((l) =>
      l.attributes("href")?.startsWith("#"),
    );
    expect(hashLinks.length).toBeGreaterThan(0);
  });

  // ─── sections data property ───────────────────────────────────────────────
  it("has sections array with id and title", () => {
    const wrapper = createWrapper();
    expect(Array.isArray(wrapper.vm.sections)).toBe(true);
    expect(wrapper.vm.sections.length).toBeGreaterThan(3);
    wrapper.vm.sections.forEach((s: Record<string, string>) => {
      expect(s).toHaveProperty("id");
      expect(s).toHaveProperty("title");
      expect(typeof s.id).toBe("string");
      expect(typeof s.title).toBe("string");
    });
  });

  it("each section id matches an anchor in the page", () => {
    const wrapper = createWrapper();
    wrapper.vm.sections.forEach((s: Record<string, string>) => {
      const el = wrapper.find(`#${s.id}`);
      expect(el.exists()).toBe(true);
    });
  });

  // ─── Requirements listed ──────────────────────────────────────────────────
  it("mentions Pi-hole v5 or v6 compatibility", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toMatch(/v5|v6/i);
  });

  it("describes how to find the API token", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toMatch(/settings/i);
  });

  // ─── Code blocks ─────────────────────────────────────────────────────────
  it("contains at least one code element for URLs/examples", () => {
    const wrapper = createWrapper();
    const codeElements = wrapper.findAll("code");
    expect(codeElements.length).toBeGreaterThan(0);
  });

  // ─── Troubleshooting ─────────────────────────────────────────────────────
  it("includes troubleshooting or FAQ section", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toMatch(/troubleshoot|FAQ|common|cors/i);
  });
});
