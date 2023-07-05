import {
    CreationOptional,
    DataTypes,
    InferAttributes,
    InferCreationAttributes,
    Model,
    Sequelize
} from "sequelize";

export class User extends Model<
    InferAttributes<User>,
    InferCreationAttributes<User>
> {
    declare id: CreationOptional<string>;
    declare username: string;
    declare hash: string;
    declare salt: string;
    declare requireSignIn: CreationOptional<boolean>;

    static initModel(sequelize: Sequelize) {
        User.init(
            {
                id: {
                    type: DataTypes.UUID,
                    primaryKey: true,
                    defaultValue: DataTypes.UUIDV4
                },
                username: {
                    type: DataTypes.CITEXT,
                    unique: true,
                    allowNull: false
                },
                hash: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                salt: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                requireSignIn: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false
                }
            },
            {
                sequelize
            }
        );
    }
}
