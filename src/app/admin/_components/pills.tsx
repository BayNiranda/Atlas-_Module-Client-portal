import { sourceLabel, stageLabel, stageTone } from "@/modules/inquiries/labels";

export const StagePill = ({ stage }: { stage: string }) => <span className={`st ${stageTone(stage)}`}>{stageLabel(stage)}</span>;
export const SourcePill = ({ source }: { source: string }) => <span className="st">{sourceLabel(source)}</span>;
