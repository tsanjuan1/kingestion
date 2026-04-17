import { redirect } from "next/navigation";

export default function WorkflowAdminPage() {
  redirect("/settings?view=workflow");
}
