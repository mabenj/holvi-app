import { signOut } from "@/lib/client/auth";
import { SignedInPageProps, signedInPageProps } from "@/lib/common/signed-in-page";
import { getErrorMessage } from "@/lib/common/utilities";
import AppShell from "@/lib/components/app-shell/AppShell";
import Activity from "@/lib/components/settings/Activity";
import Backups from "@/lib/components/settings/Backups";
import VideoProcessing from "@/lib/components/settings/VideoProcessing";
import ConfirmationSurface from "@/lib/components/surfaces/ConfirmationSurface";
import {
    GRID_DENSITIES,
    parseGridDensity,
    useGridDensity
} from "@/lib/hooks/useGridDensity";
import {
    Box,
    Button,
    Heading,
    SegmentGroup,
    Stack,
    Text
} from "@chakra-ui/react";
import { mdiLogout } from "@mdi/js";
import Icon from "@mdi/react";
import { useTheme } from "next-themes";
import { useRouter } from "next/router";
import { ReactNode, useEffect, useState } from "react";

export const getServerSideProps = signedInPageProps;

export default function SettingsTab({ user }: SignedInPageProps) {
    return (
        <AppShell title="Settings">
            <Stack gap="8" px="4" py="4" maxW="lg">
                <Section title="Activity">
                    <Activity />
                </Section>
                <Section title="Backups">
                    <Backups />
                </Section>
                <Section title="Video processing">
                    <VideoProcessing />
                </Section>
                <Section title="Appearance">
                    <ThemeSetting />
                    <GridDensitySetting />
                </Section>
                <Section title="Account">
                    <SignOutSetting username={user.username} />
                </Section>
            </Stack>
        </AppShell>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <Box as="section">
            <Heading
                as="h2"
                textStyle="xs"
                fontWeight="semibold"
                textTransform="uppercase"
                letterSpacing="wider"
                color="fg.muted"
                mb="3">
                {title}
            </Heading>
            <Stack gap="5">{children}</Stack>
        </Box>
    );
}

function Setting({
    label,
    hint,
    children
}: {
    label: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <Stack gap="2">
            <Box>
                <Text fontWeight="medium">{label}</Text>
                {hint && (
                    <Text textStyle="sm" color="fg.muted">
                        {hint}
                    </Text>
                )}
            </Box>
            {children}
        </Stack>
    );
}

const THEME_OPTIONS = [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
    { value: "system", label: "System" }
];

function ThemeSetting() {
    const { theme, setTheme } = useTheme();
    // The stored theme is only known in the browser
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    return (
        <Setting label="Theme">
            <SegmentGroup.Root
                aria-label="Theme"
                size="lg"
                value={mounted ? theme ?? null : null}
                onValueChange={({ value }) => value && setTheme(value)}>
                <SegmentGroup.Indicator />
                <SegmentGroup.Items items={THEME_OPTIONS} flex="1" />
            </SegmentGroup.Root>
        </Setting>
    );
}

function GridDensitySetting() {
    const [density, setDensity] = useGridDensity();

    return (
        <Setting
            label="Grid density"
            hint="Columns on a phone. Larger screens show proportionally more.">
            <SegmentGroup.Root
                aria-label="Grid density"
                size="lg"
                value={String(density)}
                onValueChange={({ value }) => {
                    const next = parseGridDensity(value);
                    if (next) setDensity(next);
                }}>
                <SegmentGroup.Indicator />
                <SegmentGroup.Items
                    items={GRID_DENSITIES.map(String)}
                    flex="1"
                />
            </SegmentGroup.Root>
        </Setting>
    );
}

function SignOutSetting({ username }: { username: string }) {
    const router = useRouter();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [error, setError] = useState<string>();

    const onConfirm = async () => {
        setSigningOut(true);
        setError(undefined);
        try {
            await signOut();
            await router.replace("/login");
        } catch (error) {
            setError(getErrorMessage(error));
            setSigningOut(false);
            setConfirmOpen(false);
        }
    };

    return (
        <Setting label="Signed in" hint={username}>
            <Button
                variant="outline"
                size="lg"
                colorPalette="red"
                onClick={() => setConfirmOpen(true)}>
                <Icon path={mdiLogout} size="20px" aria-hidden />
                Sign out
            </Button>
            {error && (
                <Text textStyle="sm" color="fg.error">
                    {error}
                </Text>
            )}
            <ConfirmationSurface
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                title="Sign out?"
                description="You will need your username and password to sign in again."
                confirmLabel="Sign out"
                onConfirm={onConfirm}
                confirming={signingOut}
                destructive
            />
        </Setting>
    );
}
