import { UserDto } from "../types/user-dto";
import { withUserSsr } from "./route-helpers";

export interface SignedInPageProps {
    user: UserDto;
}

/**
 * getServerSideProps for a screen that needs a signed-in user. Sends anyone else
 * to sign-in, including a session whose user no longer exists.
 */
export const signedInPageProps = withUserSsr<{ user: UserDto }>(
    async ({ req }) => ({ props: { user: req.session.user } })
);
