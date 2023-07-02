
export const sessionOptions = {
    password: "jfAyFugpUMg3jUbAtKYJob1B8g8LGZwe",
    cookieName: "homeworkapp",
    cookieOptions: {
        maxAge: undefined,
        secure: process.env.NODE_ENV === "production",
        ttl: 2 * 60 * 60 // 2 hr
    }
};