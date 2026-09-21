import ErrorScreen from "@/lib/components/app-shell/ErrorScreen";

export default function ServerError() {
    return (
        <ErrorScreen
            code={500}
            title="Something went wrong"
            description="Holvi ran into a problem. Try again in a moment."
        />
    );
}
