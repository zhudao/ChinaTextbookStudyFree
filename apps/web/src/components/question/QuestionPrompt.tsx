"use client";
import type { ReactNode } from "react";
import { MathText } from "@/components/MathText";
import { TTSButton } from "@/components/TTSButton";
export function QuestionPrompt({
  text,
  audio,
  action,
  locked = false,
}: {
  text: string;
  audio?: string | null;
  action?: ReactNode;
  locked?: boolean;
}) {
  return (
    <div className="question-prompt">
      <h2>
        <MathText text={text} />
      </h2>
      {action ?? <TTSButton src={audio} label="朗读题目" disabled={locked} />}
    </div>
  );
}
