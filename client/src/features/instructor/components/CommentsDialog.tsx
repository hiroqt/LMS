import { MessageSquare } from "lucide-react";
import { useState } from "react";
import type { CommentTarget } from "../../../shared/api/comments";
import { InstructorClassThread, InstructorPrivateThreads, type RosterStudent } from "../../../shared/components/discussion/Comments";
import { Button } from "../../../shared/ui/Button";
import { Dialog, DialogContent } from "../../../shared/ui/Dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/ui/Tabs";
import { useInstructorSession } from "../hooks/useInstructorSession";

/**
 * A "Comments" button on a material or a piece of coursework. It opens the class comments
 * and every student's private comments on it, where the instructor reads and replies (D-075).
 */
export function CommentsButton({ title, target, roster }: { title: string; target: CommentTarget; roster: RosterStudent[] }) {
  const { instructorId } = useInstructorSession();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"class" | "private">("class");
  const viewer = { id: instructorId, role: "instructor" as const };

  return (
    <>
      <Button variant="ghost" icon={<MessageSquare aria-hidden className="size-4" />} aria-label={`Comments on ${title}`} onClick={() => setOpen(true)}>
        Comments
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <DialogContent className="sm:max-w-2xl" title={`Comments on ${title}`} description="Class comments are seen by everyone in the class. Private comments are between you and one student.">
            <Tabs value={tab} onValueChange={(value) => setTab(value === "private" ? "private" : "class")} className="flex flex-col gap-4">
              <TabsList aria-label="Comment type">
                <TabsTrigger value="class">Class comments</TabsTrigger>
                <TabsTrigger value="private">Private comments</TabsTrigger>
              </TabsList>
              <TabsContent value="class">
                <InstructorClassThread viewer={viewer} target={target} />
              </TabsContent>
              <TabsContent value="private">
                <InstructorPrivateThreads viewer={viewer} target={target} roster={roster} />
              </TabsContent>
            </Tabs>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
