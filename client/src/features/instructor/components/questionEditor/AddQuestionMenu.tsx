import { ChevronDown, Plus } from "lucide-react";
import { useRef } from "react";
import { Button } from "../../../../shared/ui/Button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../../../../shared/ui/Menu";
import { QUESTION_TYPE_HINTS, QUESTION_TYPE_LABELS, QUESTION_TYPES, type QuestionType } from "../../api/questionSets";
import { focusTarget } from "./focus";

/** "Add question" by type, each with a one-line hint. Returns the new question's key so focus can move to it. */
export function AddQuestionMenu({ context, onAdd }: { context?: string; onAdd: (type: QuestionType) => string }) {
  const added = useRef<string | null>(null);
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary" className="self-start" icon={<Plus aria-hidden className="size-4" />}>
          Add question{context && <>{" "}<span className="sr-only">{context}</span></>}
          <ChevronDown aria-hidden className="size-4" />
        </Button>
      </MenuTrigger>
      <MenuContent
        align="start"
        className="max-h-(--radix-dropdown-menu-content-available-height) w-80 max-w-[calc(100vw-2rem)] overflow-y-auto"
        onCloseAutoFocus={(event) => {
          // Move to the new question's prompt instead of back to the button.
          const key = added.current;
          added.current = null;
          if (key) {
            event.preventDefault();
            requestAnimationFrame(() => focusTarget(`${key}:prompt`));
          }
        }}
      >
        {QUESTION_TYPES.map((type) => (
          <MenuItem key={type} className="flex-col items-start justify-center gap-0 py-2" onSelect={() => (added.current = onAdd(type))}>
            <span className="font-semibold text-ink">{QUESTION_TYPE_LABELS[type]}</span>
            <span className="text-muted">{QUESTION_TYPE_HINTS[type]}</span>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
