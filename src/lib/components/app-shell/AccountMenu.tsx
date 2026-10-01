import { signOut } from "@/lib/client/auth";
import { getErrorMessage } from "@/lib/common/utilities";
import { IconButton, Menu, Portal, Spinner, Text } from "@chakra-ui/react";
import { mdiAccountCircleOutline, mdiLogout } from "@mdi/js";
import Icon from "@mdi/react";
import { useRouter } from "next/router";
import { useRef, useState } from "react";

/**
 * The page header's account button: a menu naming the signed-in user, with
 * Sign out. Signing out takes no confirmation and holds the menu open until it
 * ends, so its progress and any failure show where it was tapped.
 */
export default function AccountMenu({ username }: { username: string }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [error, setError] = useState<string>();
    // Selections arriving before the item disables must not sign out twice
    const signingOutRef = useRef(false);

    const onSignOut = async () => {
        if (signingOutRef.current) return;
        signingOutRef.current = true;
        setSigningOut(true);
        setError(undefined);
        try {
            await signOut();
            // Replaced, so Back does not return to a signed-in screen
            await router.replace("/login");
        } catch (failure) {
            setError(getErrorMessage(failure));
            signingOutRef.current = false;
            setSigningOut(false);
        }
    };

    return (
        <Menu.Root
            positioning={{ placement: "bottom-end" }}
            open={open}
            onOpenChange={({ open }) => {
                // Signing out ends in a new page or in a failure to show here
                if (!open && signingOut) return;
                // A failure belongs to the attempt it reported
                if (open) setError(undefined);
                setOpen(open);
            }}
            onSelect={({ value }) => {
                if (value === "sign-out") void onSignOut();
            }}>
            <Menu.Trigger asChild>
                <IconButton
                    aria-label="Account"
                    variant="ghost"
                    flexShrink="0">
                    <Icon path={mdiAccountCircleOutline} size="24px" aria-hidden />
                </IconButton>
            </Menu.Trigger>
            <Portal>
                <Menu.Positioner>
                    <Menu.Content minW="44" maxW="72">
                        <Menu.ItemGroup>
                            <Menu.ItemGroupLabel truncate>
                                {username}
                            </Menu.ItemGroupLabel>
                            <Menu.Item
                                value="sign-out"
                                closeOnSelect={false}
                                disabled={signingOut}>
                                {signingOut ? (
                                    <Spinner size="xs" />
                                ) : (
                                    <Icon path={mdiLogout} size="18px" aria-hidden />
                                )}
                                {signingOut ? "Signing out…" : "Sign out"}
                            </Menu.Item>
                        </Menu.ItemGroup>
                        {error && (
                            <Text
                                px="2"
                                py="1.5"
                                textStyle="sm"
                                color="fg.error"
                                role="alert">
                                {error}
                            </Text>
                        )}
                    </Menu.Content>
                </Menu.Positioner>
            </Portal>
        </Menu.Root>
    );
}
