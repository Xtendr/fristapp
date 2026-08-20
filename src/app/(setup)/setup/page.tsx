import { AuthChrome } from "@/components/auth-chrome"
import { CreateHouseholdForm } from "@/components/create-household-form"
import { JoinTokenForm } from "@/components/join-token-form"
import { SignOutButton } from "@/components/household-actions"

export default function SetupPage() {
  return (
    <AuthChrome
      title="Set up your household"
      description="Food in Frist belongs to a household, not to one person. Create one, or join with an invite link."
    >
      <div className="flex flex-col gap-8">
        <CreateHouseholdForm />
        <JoinTokenForm />
        <SignOutButton />
      </div>
    </AuthChrome>
  )
}
