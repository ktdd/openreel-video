import "../../test/install-local-storage-mock";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToolcraftIconButton } from "@openreel/ui";
import { useThemeStore } from "../../stores/theme-store";
import { useSettingsStore } from "../../stores/settings-store";
import { EditorActionRail } from "./EditorActionRail";

describe("EditorActionRail", () => {
  beforeEach(() => {
    useThemeStore.getState().setMode("light");
    useSettingsStore.getState().closeSettings();
  });

  afterEach(() => {
    cleanup();
    useSettingsStore.getState().closeSettings();
    vi.restoreAllMocks();
  });

  it("exposes theme switching as a visible rail action", () => {
    render(<EditorActionRail />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Theme: Light. Switch to Dark",
      }),
    );

    expect(useThemeStore.getState().mode).toBe("dark");
    expect(
      screen.getByRole("button", {
        name: "Theme: Dark. Switch to Light",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Theme: Dark. Switch to Light" }));
    expect(useThemeStore.getState().mode).toBe("light");
    expect(screen.getByRole("button", { name: "Theme: Light. Switch to Dark" })).toBeInTheDocument();
  });

  it("keeps accessible labels while suppressing native titles on every rail control", () => {
    render(<EditorActionRail />);
    const buttons = within(screen.getByRole("navigation", { name: "Editor tools" })).getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(5);
    for (const button of buttons) {
      expect(button).toHaveAccessibleName();
      expect(button).not.toHaveAttribute("title");
    }
  });

  it("retains the custom tooltip for keyboard focus", async () => {
    render(<EditorActionRail />);
    fireEvent.focus(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Undo");
  });

  it("opens Settings directly below the theme control and reflects its active state", () => {
    render(<EditorActionRail />);
    const buttons = within(screen.getByRole("navigation", { name: "Editor tools" })).getAllByRole("button");
    const theme = screen.getByRole("button", { name: "Theme: Light. Switch to Dark" });
    const settings = screen.getByRole("button", { name: "Settings" });
    expect(buttons[buttons.indexOf(theme) + 1]).toBe(settings);
    expect(settings).not.toHaveClass("bg-bg-2");
    fireEvent.click(settings);
    expect(useSettingsStore.getState().settingsOpen).toBe(true);
    expect(settings).toHaveClass("bg-bg-2");
  });

  it("retains help, project JSON and search hints without an obsolete settings/API-keys item", () => {
    render(<EditorActionRail />);
    fireEvent.keyDown(screen.getByRole("button", { name: "More editor actions" }), { key: "ArrowDown" });
    const menu = within(screen.getByRole("menu"));
    expect(menu.getByRole("menuitem", { name: "Help & shortcuts (press ?)" })).toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: "Project JSON" })).toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: "Ctrl/Cmd+K to search" })).toBeInTheDocument();
    expect(menu.queryByRole("menuitem", { name: /Settings|API keys/i })).not.toBeInTheDocument();
  });
});

describe("shared icon button native titles", () => {
  afterEach(() => cleanup());

  it.each([
    [undefined, "Accessible action"],
    ["Custom title", "Custom title"],
    ["", null],
  ])("resolves title %s without losing the accessible label", (title, expected) => {
    render(<ToolcraftIconButton label="Accessible action" title={title} icon={<span aria-hidden>+</span>} />);
    const button = screen.getByRole("button", { name: "Accessible action" });
    if (expected === null) expect(button).not.toHaveAttribute("title");
    else expect(button).toHaveAttribute("title", expected);
  });
});
