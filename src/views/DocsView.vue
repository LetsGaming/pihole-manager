<template>
  <ion-page class="page-wrapper">
    <PageHeader title="Documentation" />

    <ion-content class="page-content">
      <div class="docs-layout">
        <!-- Sidebar nav -->
        <nav class="docs-sidebar" aria-label="Documentation sections">
          <div class="section-label" style="padding: 0 0 6px">Contents</div>
          <a
            v-for="section in sections"
            :key="section.id"
            :href="`#${section.id}`"
            class="docs-nav-link"
            :class="{ active: activeSection === section.id }"
            @click.prevent="scrollToSection(section.id)"
          >
            {{ section.title }}
          </a>
        </nav>

        <!-- Main content -->
        <main class="docs-main">
          <!-- Loading -->
          <div v-if="loading" class="docs-loading">
            <div v-for="i in 6" :key="i" class="skeleton" :style="`height: ${i === 1 ? 32 : 18}px; width: ${[60,90,70,85,55,75][i-1]}%; margin-bottom: 12px`" />
          </div>

          <!-- Error -->
          <div v-else-if="error" class="docs-error">
            <ion-icon :icon="warningOutline" style="font-size: 20px" />
            <span>{{ error }}</span>
          </div>

          <!-- Rendered content -->
          <template v-else>
            <div
              v-for="section in sections"
              :key="section.id"
              :id="section.id"
              class="docs-section"
            >
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div class="docs-content" v-html="section.html" />
              <hr v-if="section.id !== sections[sections.length - 1].id" class="docs-divider" />
            </div>
          </template>
        </main>
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { IonPage, IonContent, IonIcon } from "@ionic/vue";
import { warningOutline } from "ionicons/icons";
import PageHeader from "@/components/ui/PageHeader.vue";

/** ─── Lightweight Markdown → HTML renderer ──────────────────────────────────
 *  Handles: headings, bold, italic, code fences, inline code, tables,
 *  ordered/unordered lists, paragraphs, horizontal rules.
 *  No external dependency required.
 */
function renderMarkdown(md: string): string {
  // Escape HTML entities in a string (used for code blocks)
  function esc(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ──────────────────────────────────────────────────
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(esc(lines[i]));
        i++;
      }
      out.push(
        `<pre${lang ? ` class="language-${lang}"` : ""}><code>${codeLines.join("\n")}</code></pre>`
      );
      i++; // skip closing ```
      continue;
    }

    // ── Heading ────────────────────────────────────────────────────────────
    const hMatch = line.match(/^(#{1,4})\s+(.*)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = inlineRender(hMatch[2]);
      // generate an id from the heading text
      const id = hMatch[2]
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      out.push(`<h${level} id="${id}">${text}</h${level}>`);
      i++;
      continue;
    }

    // ── Horizontal rule ────────────────────────────────────────────────────
    if (/^---+$/.test(line.trim())) {
      out.push("<hr />");
      i++;
      continue;
    }

    // ── Table ──────────────────────────────────────────────────────────────
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1].includes("|") && /^[\s|:-]+$/.test(lines[i + 1])) {
      const headerCells = line.split("|").map(c => c.trim()).filter(Boolean);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        rows.push(lines[i].split("|").map(c => c.trim()).filter(Boolean));
        i++;
      }
      const thead = `<tr>${headerCells.map(c => `<th>${inlineRender(c)}</th>`).join("")}</tr>`;
      const tbody = rows.map(r => `<tr>${r.map(c => `<td>${inlineRender(c)}</td>`).join("")}</tr>`).join("");
      out.push(`<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`);
      continue;
    }

    // ── Unordered list ─────────────────────────────────────────────────────
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(`<li>${inlineRender(lines[i].replace(/^[-*]\s/, ""))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // ── Ordered list ───────────────────────────────────────────────────────
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${inlineRender(lines[i].replace(/^\d+\.\s/, ""))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // ── Empty line ─────────────────────────────────────────────────────────
    if (line.trim() === "") {
      i++;
      continue;
    }

    // ── Paragraph ─────────────────────────────────────────────────────────
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("```") &&
      !/^[-*]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !lines[i].includes("|")
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      out.push(`<p>${inlineRender(paraLines.join(" "))}</p>`);
    }
  }

  return out.join("\n");
}

/** Render inline Markdown: bold, italic, inline code, links */
function inlineRender(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Markdown links [text](url) — keep as plain text for in-app docs
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

// ── Section manifest ────────────────────────────────────────────────────────
// Each entry maps an id + title to a markdown file imported via Vite glob.
// The order here controls sidebar order and page order.
const DOC_SECTIONS: Array<{ id: string; title: string; file: string }> = [
  { id: "getting-started",   title: "Getting Started",     file: "getting-started.md"   },
  { id: "dashboard",         title: "Dashboard",           file: "dashboard.md"          },
  { id: "query-log",         title: "Query Log",           file: "query-log.md"          },
  { id: "block-lists",       title: "Block Lists",         file: "block-lists.md"        },
  { id: "statistics",        title: "Statistics",          file: "statistics.md"         },
  { id: "hardware",          title: "Hardware",            file: "hardware.md"           },
  { id: "api-compatibility", title: "API Compatibility",   file: "api-compatibility.md"  },
  { id: "cors-and-proxy",    title: "CORS & Dev Proxy",    file: "cors-and-proxy.md"     },
  { id: "troubleshooting",   title: "Troubleshooting",     file: "troubleshooting.md"    },
  { id: "architecture",      title: "Architecture",        file: "architecture.md"       },
];

// Vite's import.meta.glob with ?raw gives us the file content as a string.
// The path must be a string literal — no dynamic concatenation.
const rawFiles = import.meta.glob("../docs/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

function loadSection(file: string): string {
  const key = `../docs/${file}`;
  const raw = rawFiles[key];
  if (!raw) return `<p class="text-muted">Documentation file <code>${file}</code> not found.</p>`;
  return renderMarkdown(raw);
}

export default defineComponent({
  name: "DocsView",

  components: { IonPage, IonContent, IonIcon, PageHeader },

  data() {
    return {
      loading: false,
      error: null as string | null,
      activeSection: DOC_SECTIONS[0].id,
      sections: [] as Array<{ id: string; title: string; html: string }>,
      warningOutline,
    };
  },

  mounted() {
    this.buildSections();
  },

  methods: {
    buildSections(): void {
      this.loading = true;
      try {
        this.sections = DOC_SECTIONS.map(s => ({
          id: s.id,
          title: s.title,
          html: loadSection(s.file),
        }));
      } catch (e) {
        this.error = "Failed to load documentation.";
      } finally {
        this.loading = false;
      }
    },

    scrollToSection(id: string): void {
      this.activeSection = id;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
  },
});
</script>

<style scoped>
.docs-layout {
  display: grid;
  grid-template-columns: 196px 1fr;
  gap: 40px;
  max-width: 1080px;
  align-items: start;
}

/* ── Sidebar ── */
.docs-sidebar {
  position: sticky;
  top: 0;
}

.docs-nav-link {
  display: block;
  padding: 5px var(--space-2);
  font-size: 13px;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: var(--radius-sm);
  border-left: 2px solid transparent;
  transition: color var(--duration-fast), background var(--duration-fast), border-color var(--duration-fast);
  margin-bottom: 1px;
  line-height: 1.4;
}
.docs-nav-link:hover {
  color: var(--text-secondary);
  background: var(--bg-hover);
}
.docs-nav-link.active {
  color: var(--accent);
  border-left-color: var(--accent);
  background: var(--accent-subtle);
}

/* ── Main ── */
.docs-main {
  min-width: 0;
}

.docs-section {
  scroll-margin-top: var(--space-5);
}

.docs-divider {
  border: none;
  border-top: 1px solid var(--border-subtle);
  margin: 40px 0;
}

/* ── Loading / Error ── */
.docs-loading { max-width: 600px; }
.docs-error {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-red);
  font-size: 13px;
  padding: var(--space-4);
  background: var(--color-red-subtle);
  border: 1px solid var(--color-red-border);
  border-radius: var(--radius-md);
}

/* ── Responsive ── */
@media (max-width: 860px) {
  .docs-layout {
    grid-template-columns: 1fr;
    gap: var(--space-5);
  }
  .docs-sidebar {
    position: static;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--border-subtle);
  }
  .docs-nav-link {
    border-left: none;
    border-bottom: 2px solid transparent;
    padding: 4px var(--space-2);
  }
  .docs-nav-link.active {
    border-bottom-color: var(--accent);
    border-left-color: transparent;
  }
}
</style>
