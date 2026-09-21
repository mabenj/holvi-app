import { EmptyState, VStack } from "@chakra-ui/react";
import Icon from "@mdi/react";

interface PlaceholderProps {
    icon: string;
    title: string;
    description: string;
}

/** Stands in for a screen whose content has not been built yet */
export default function Placeholder({ icon, title, description }: PlaceholderProps) {
    return (
        <EmptyState.Root>
            <EmptyState.Content>
                <EmptyState.Indicator>
                    <Icon path={icon} size="48px" aria-hidden />
                </EmptyState.Indicator>
                <VStack textAlign="center">
                    <EmptyState.Title>{title}</EmptyState.Title>
                    <EmptyState.Description>{description}</EmptyState.Description>
                </VStack>
            </EmptyState.Content>
        </EmptyState.Root>
    );
}
