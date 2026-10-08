/**
 * Guided tours, one per page. Each step points at an element marked
 * `data-tour="<target>"`; a step without a target is a centered message.
 * Text lives in messages/*.json under tour.<tourId>.<stepKey>.{title,body}.
 *
 * Steps whose element isn't on screen are skipped at run time, so it's fine to
 * list things that only exist sometimes (the agent card when there are agents,
 * sidebar links on desktop).
 */
export type TourSide = "top" | "right" | "bottom" | "left";

export interface TourStep {
  key: string;
  target?: string;
  side?: TourSide;
}

export const TOURS = {
  dashboard: [
    { key: "welcome" },
    { key: "checklist", target: "getting-started", side: "bottom" },
    { key: "agents", target: "nav-agents", side: "right" },
    { key: "inbox", target: "nav-inbox", side: "right" },
    { key: "leads", target: "nav-leads", side: "right" },
    { key: "replay", target: "tour-replay", side: "left" },
  ],
  agents: [
    { key: "create", target: "agents-create", side: "left" },
    { key: "card", target: "agent-card", side: "bottom" },
  ],
  "agent-new": [
    { key: "name", target: "agent-name", side: "bottom" },
    { key: "description", target: "agent-description", side: "bottom" },
    { key: "type", target: "agent-type", side: "bottom" },
    { key: "prompt", target: "agent-prompt", side: "top" },
    { key: "files", target: "agent-files-hint", side: "top" },
    { key: "create", target: "agent-create-submit", side: "top" },
  ],
  agent: [
    { key: "settings", target: "agent-tab-settings", side: "bottom" },
    { key: "files", target: "agent-tab-files", side: "bottom" },
    { key: "test", target: "agent-tab-test", side: "bottom" },
    { key: "embed", target: "agent-tab-embed", side: "bottom" },
    { key: "active", target: "agent-active", side: "bottom" },
  ],
  inbox: [
    { key: "welcome" },
    { key: "tabs", target: "inbox-tabs", side: "bottom" },
    { key: "list", target: "inbox-list", side: "right" },
  ],
} satisfies Record<string, TourStep[]>;

export type TourId = keyof typeof TOURS;
