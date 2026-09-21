import AppShell from "@/lib/components/app-shell/AppShell";
import Placeholder from "@/lib/components/app-shell/Placeholder";
import { signedInPageProps } from "@/lib/common/signed-in-page";
import { mdiImageMultipleOutline } from "@mdi/js";

export const getServerSideProps = signedInPageProps;

export default function CollectionPage() {
    return (
        <AppShell title="Collection">
            <Placeholder
                icon={mdiImageMultipleOutline}
                title="Collection pages are on their way"
                description="Opening a collection arrives in a later update."
            />
        </AppShell>
    );
}
