import AppShell from "@/lib/components/app-shell/AppShell";
import Placeholder from "@/lib/components/app-shell/Placeholder";
import { signedInPageProps } from "@/lib/common/signed-in-page";
import { mdiTimelineClockOutline } from "@mdi/js";

export const getServerSideProps = signedInPageProps;

export default function TimelineTab() {
    return (
        <AppShell title="Timeline">
            <Placeholder
                icon={mdiTimelineClockOutline}
                title="The Timeline is on its way"
                description="Every file you own, newest first, arrives in a later update."
            />
        </AppShell>
    );
}
