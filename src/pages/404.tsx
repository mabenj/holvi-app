import ErrorScreen from "@/lib/components/app-shell/ErrorScreen";

export default function NotFound() {
    return (
        <ErrorScreen
            code={404}
            title="Nothing here"
            description="This page doesn't exist, or it was moved or deleted."
        />
    );
}
