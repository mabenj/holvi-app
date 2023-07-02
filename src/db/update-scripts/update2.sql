CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    label CITEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection_tags (
    id SERIAL PRIMARY KEY,
    collection_id INT REFERENCES collections(id) ON DELETE CASCADE,
    label CITEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    collection_id INT REFERENCES collections(id) ON DELETE CASCADE,
    label CITEXT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    filepath CITEXT NOT NULL UNIQUE,
    thumbnail_path CITEXT NOT NULL UNIQUE,
    width INT NOT NULL,
    height INT NOT NULL,
    thumbnail_width INT NOT NULL,
    thumbnail_height INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS file_tags (
    id SERIAL PRIMARY KEY,
    file_id INT REFERENCES files(id) ON DELETE CASCADE,
    label CITEXT NOT NULL
);