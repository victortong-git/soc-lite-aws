# Storage Services

Infrastructure scripts for AWS storage services (S3, RDS).

## Directory Structure

```
storage/
├── s3/                  # S3 bucket management
│   ├── create-bucket.sh
│   ├── sync-frontend.sh
│   └── README.md
├── rds/                 # RDS database management (symlinks)
│   ├── start-db.sh -> ../../../database/rds/scripts/start_db.sh
│   ├── stop-db.sh -> ../../../database/rds/scripts/stop_db.sh
│   ├── status-db.sh -> ../../../database/rds/scripts/status_db.sh
│   └── README.md
└── README.md
```

## Quick Start

### Create S3 Bucket

```bash
cd s3
./create-bucket.sh --bucket-name my-bucket --purpose website --public
```

### Sync Frontend to S3

```bash
cd s3
./sync-frontend.sh --bucket-name my-bucket --distribution-id E1234567890ABC
```

### Manage RDS Database

```bash
cd rds
./start-db.sh     # Start RDS instance
./stop-db.sh      # Stop RDS instance
./status-db.sh    # Check RDS status
```

## Available Scripts

### S3
- **create-bucket.sh** - Create S3 bucket with versioning and encryption
- **sync-frontend.sh** - Upload frontend assets to S3 and invalidate CloudFront cache

### RDS
- **start-db.sh** - Start RDS PostgreSQL instance
- **stop-db.sh** - Stop RDS instance (saves costs)
- **status-db.sh** - Check RDS instance status

Note: RDS scripts are symlinks to `../../../database/rds/scripts/`. See [Database Documentation](../../../database/README.md) for full RDS management capabilities.

## Configuration

All scripts use the centralized configuration from `../config/config.sh`.

## Documentation

- [S3 Documentation](s3/README.md)
- [RDS Documentation](rds/README.md)
- [Full Database Documentation](../../../database/README.md)
