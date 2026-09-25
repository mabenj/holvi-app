import { UserDto } from "../types/user-dto";
import { withUserSsr } from "./route-helpers";

// A type alias rather than an interface: withUserSsr needs an index signature
export type SignedInPageProps = {
    user: UserDto;
};

/**
 * getServerSideProps for a screen that needs a signed-in user. Sends anyone else
 * to sign-in, including a session whose user no longer exists.
 */
export const signedInPageProps = withUserSsr<SignedInPageProps>(
    async ({ req }) => ({ props: { user: req.session.user } })
);
