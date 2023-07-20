import { Flex, Spinner } from "@chakra-ui/react";
import React from "react";

export default function IfNotLoading({
    children,
    isLoading,
    fallback
}: {
    children: React.ReactNode;
    isLoading: boolean;
    fallback?: React.ReactNode;
}) {
    fallback ??= (
        <Flex
            alignItems="center"
            justifyContent="center"
            w="100%"
            gap={3}
            py={5}>
            <Spinner size="sm" />
            <span>Loading...</span>
        </Flex>
    );
    return isLoading ? fallback : children;
}
