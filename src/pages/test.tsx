import { withUserSsr } from "@/lib/common/route-helpers";
import Dialog from "@/lib/components/ui/Dialog";
import Layout from "@/lib/components/ui/Layout";
import { UserDto } from "@/lib/types/user-dto";
import { Button, Heading, useDisclosure } from "@chakra-ui/react";

export const getServerSideProps = withUserSsr(
    async function getServerSideProps({ req }) {
        return {
            props: {
                user: req.session.user
            }
        };
    }
);

export default function Test({ user }: { user: UserDto }) {
    const { isOpen, onOpen, onClose } = useDisclosure();

    return (
        <Layout user={user}>
            <Dialog
                trigger={<Button>Open! (isOpen={isOpen.toString()})</Button>}
                title={<Heading>Title haha</Heading>}
                isOpen={isOpen}
                onOpen={onOpen}
                onClose={onClose}>
                <p>
                    jee jeee Lorem ipsum dolor sit, amet consectetur adipisicing
                    elit. Officiis facere rem laborum iusto neque qui modi,
                    aliquid provident impedit nisi commodi earum quia at aliquam
                    velit optio ipsam fugiat pariatur. Provident illo pariatur,
                    itaque accusamus consequatur alias, illum, repellendus rerum
                    eveniet laudantium dolore totam rem! Accusantium, qui quas
                    iste, quam eligendi a corrupti pariatur nam dolorem autem
                    officia aut facere. Pariatur sed animi quisquam fugiat quam
                    voluptas a nostrum veniam alias laudantium et nihil quae
                    consectetur dolorum delectus blanditiis laborum,
                    reprehenderit voluptate odio perspiciatis! Veniam ad
                    voluptatem nihil modi quod. Minus, velit ratione molestiae
                    dolorum accusamus totam soluta cumque voluptatum est
                    mollitia id ex fuga aut consequuntur, excepturi eius
                    corrupti rem facere veritatis earum distinctio quos facilis.
                    Nulla, maxime consectetur? Explicabo accusantium
                    consequuntur sit mollitia harum iure ratione, at repellat
                    esse nesciunt odit tempore quod. Voluptate nihil dolorem
                    cumque quas delectus. Saepe corrupti, in tempora praesentium
                    quibusdam ratione similique voluptatibus!
                </p>
            </Dialog>
        </Layout>
    );
}
