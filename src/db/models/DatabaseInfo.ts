import {
    DataTypes,
    InferAttributes,
    InferCreationAttributes,
    Model,
    Sequelize
} from "sequelize";

export class DatabaseInfo extends Model<
    InferAttributes<DatabaseInfo>,
    InferCreationAttributes<DatabaseInfo>
> {
    declare id: number;
    declare version: number;

    static initModel(sequelize: Sequelize) {
        DatabaseInfo.init(
            {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true
                },
                version: { type: DataTypes.INTEGER, defaultValue: 1 }
            },
            { sequelize }
        );
    }
}
