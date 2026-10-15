import { ArrowElbowDownLeftIcon } from "@phosphor-icons/react/dist/ssr/ArrowElbowDownLeft";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ArrowCounterClockwise";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ArrowUpIcon } from "@phosphor-icons/react/dist/ssr/ArrowUp";
import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { DesktopIcon } from "@phosphor-icons/react/dist/ssr/Desktop";
import { DotsThreeVerticalIcon } from "@phosphor-icons/react/dist/ssr/DotsThreeVertical";
import { FastForwardIcon } from "@phosphor-icons/react/dist/ssr/FastForward";
import { FolderSimpleIcon } from "@phosphor-icons/react/dist/ssr/FolderSimple";
import { GlobeIcon } from "@phosphor-icons/react/dist/ssr/Globe";
import { LaptopIcon } from "@phosphor-icons/react/dist/ssr/Laptop";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/ssr/Microphone";
import { MoonIcon } from "@phosphor-icons/react/dist/ssr/Moon";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";
import { SidebarSimpleIcon } from "@phosphor-icons/react/dist/ssr/SidebarSimple";
import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/ssr/SlidersHorizontal";
import { SunIcon } from "@phosphor-icons/react/dist/ssr/Sun";
import { TerminalIcon } from "@phosphor-icons/react/dist/ssr/Terminal";
import { TerminalWindowIcon } from "@phosphor-icons/react/dist/ssr/TerminalWindow";
import { LockSimpleIcon } from "@phosphor-icons/react/dist/ssr/LockSimple";
import { BankIcon } from "@phosphor-icons/react/dist/ssr/Bank";
import { InfoIcon } from "@phosphor-icons/react/dist/ssr/Info";

const icons = {
  "arrow-up-right": ArrowUpRightIcon,
  "arrow-left": ArrowLeftIcon,
  "arrow-right": ArrowRightIcon,
  "arrow-up": ArrowUpIcon,
  return: ArrowElbowDownLeftIcon,
  replay: ArrowCounterClockwiseIcon,
  chevron: CaretRightIcon,
  "caret-down": CaretDownIcon,
  check: CheckCircleIcon,
  desktop: DesktopIcon,
  dots: DotsThreeVerticalIcon,
  "fast-forward": FastForwardIcon,
  folder: FolderSimpleIcon,
  globe: GlobeIcon,
  laptop: LaptopIcon,
  microphone: MicrophoneIcon,
  moon: MoonIcon,
  plus: PlusIcon,
  sidebar: SidebarSimpleIcon,
  sliders: SlidersHorizontalIcon,
  sun: SunIcon,
  terminal: TerminalWindowIcon,
  "terminal-prompt": TerminalIcon,
  lock: LockSimpleIcon,
  bank: BankIcon,
  info: InfoIcon,
};

export function Icon({
  name,
  size = 16,
  className = "",
}: {
  name: keyof typeof icons;
  size?: number;
  className?: string;
}) {
  const Glyph = icons[name];
  return (
    <Glyph
      size={size}
      weight="bold"
      className={`icon ${className}`}
      aria-hidden="true"
      focusable="false"
    />
  );
}
