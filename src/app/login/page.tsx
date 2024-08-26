import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { Moon } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Card>
        <CardContent className="py-4">
          <form action="">
            <div className="flex flex-col gap-2">
              <Input placeholder="Username" type="text" autoComplete="false" />
              <Input placeholder="Password" type="password" />
              <Button>Login</Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col">
          <Separator className="mb-4 mt-2" />
          <div className="flex w-full items-center justify-between">
            <Button size="icon" variant="ghost">
              <Moon size="16" />
            </Button>
            <Button size={"sm"} variant={"ghost"}>
              Signup
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
