import React from "react";
import {
  ToolcraftDropdownMenu as DropdownMenu,
  ToolcraftIconButton as IconButton,
  ToolcraftTooltip as Tooltip,
} from "@openreel/ui";
import { Icon } from "@/icons/Icon";
import {
  Sun,
  Moon,
  HelpCircle,
  FileCode,
  Command,
} from "@/icons/lucide-compat";
import { useProjectStore } from "../../stores/project-store";
import { useUIStore } from "../../stores/ui-store";
import { useThemeStore } from "../../stores/theme-store";
import { useSettingsStore } from "../../stores/settings-store";

const RailButton: React.FC<{
  label: string;
  icon: string;
  onClick: () => void;
  active?: boolean;
}> = ({ label, icon, onClick, active = false }) => (
  <Tooltip content={label} placement="end">
    <IconButton
      label={label}
      title=""
      icon={<Icon name={icon} size={16} ariaHidden />}
      size="sm"
      variant={active ? "secondary" : "ghost"}
      onClick={onClick}
    />
  </Tooltip>
);

export const EditorActionRail: React.FC = () => {
  const { undo, redo } = useProjectStore();
  const {
    openModal,
    toggleKeyframeEditor,
    keyframeEditorOpen,
    panels,
    togglePanel,
    activeModal,
  } = useUIStore();
  const { mode: themeMode, toggleTheme } = useThemeStore();
  const { openSettings, settingsOpen } = useSettingsStore();

  const themeLabel = themeMode === "light" ? "Light" : "Dark";
  const nextThemeLabel = themeMode === "light" ? "Dark" : "Light";
  const themeIcon = themeMode === "light" ? (
    <Sun size={16} aria-hidden />
  ) : (
    <Moon size={16} aria-hidden />
  );
  const themeActionLabel = `Theme: ${themeLabel}. Switch to ${nextThemeLabel}`;

  return (
    <nav
      aria-label="Editor tools"
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-bg-1 py-3"
    >
      <RailButton
        label="Search tools and effects"
        icon="magnifyingglass"
        onClick={() => openModal("search")}
      />
      <RailButton
        label="Undo"
        icon="arrow.uturn.backward"
        onClick={() => void undo()}
      />
      <RailButton
        label="Redo"
        icon="arrow.uturn.forward"
        onClick={() => void redo()}
      />

      <div className="my-1.5 h-px w-6 bg-border" />

      <RailButton
        label="Action history"
        icon="clock"
        onClick={() => openModal("history")}
        active={activeModal === "history"}
      />
      <RailButton
        label="Keyframe editor"
        icon="diamond"
        onClick={toggleKeyframeEditor}
        active={keyframeEditorOpen}
      />
      <RailButton
        label="Audio mixer"
        icon="music.note"
        onClick={() => togglePanel("audioMixer")}
        active={Boolean(panels.audioMixer?.visible)}
      />
      <RailButton
        label="Project JSON / Comments"
        icon="curlybraces"
        onClick={() => openModal("scriptView")}
      />

      <div className="flex-1" />

      <Tooltip content={themeActionLabel} placement="end">
        <IconButton
          label={themeActionLabel}
          title=""
          icon={themeIcon}
          size="sm"
          variant="secondary"
          onClick={toggleTheme}
        />
      </Tooltip>

      <RailButton
        label="Settings"
        icon="gear"
        onClick={openSettings}
        active={settingsOpen}
      />

      <DropdownMenu
        placement="end"
        button={{
          label: "More editor actions",
          title: "",
          icon: <Icon name="star" size={16} ariaHidden />,
          size: "sm",
          variant: "ghost",
          isIconOnly: true,
        }}
        hasChevron={false}
        menuWidth={224}
        items={[
          {
            label: "Help & shortcuts (press ?)",
            icon: <HelpCircle size={14} aria-hidden />,
            isDisabled: true,
          },
          {
            label: "Project JSON",
            icon: <FileCode size={14} aria-hidden />,
            isDisabled: true,
          },
          {
            label: "Ctrl/Cmd+K to search",
            icon: <Command size={14} aria-hidden />,
            isDisabled: true,
          },
        ]}
      />
    </nav>
  );
};
