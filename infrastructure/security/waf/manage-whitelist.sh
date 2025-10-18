#!/bin/bash

# Manage WAF IP Whitelist
# Add or remove IP addresses from the WAF whitelist for aws1.c6web.com

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IP_SET_NAME="soc-lite-whitelist-ips"
IP_SET_ID="bd7660af-7f9e-4a95-9496-8e7aacf8d92d"
SCOPE="CLOUDFRONT"
REGION="us-east-1"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Usage
usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  list                    List all whitelisted IPs"
    echo "  add IP_ADDRESS          Add IP to whitelist (e.g., 145.40.130.179)"
    echo "  remove IP_ADDRESS       Remove IP from whitelist"
    echo "  clear                   Remove all IPs from whitelist"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 add 145.40.130.179"
    echo "  $0 remove 145.40.130.179"
    exit 1
}

# Validate IP address format
validate_ip() {
    local ip=$1
    if [[ ! $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo -e "${RED}Error: Invalid IP address format${NC}"
        exit 1
    fi
}

# Get current IP set
get_ip_set() {
    aws wafv2 get-ip-set \
        --name "$IP_SET_NAME" \
        --scope "$SCOPE" \
        --id "$IP_SET_ID" \
        --region "$REGION" \
        --output json
}

# List whitelisted IPs
list_ips() {
    echo "Whitelisted IP Addresses:"
    echo "========================="

    local addresses=$(get_ip_set | jq -r '.IPSet.Addresses[]')

    if [ -z "$addresses" ]; then
        echo "No IP addresses whitelisted"
    else
        echo "$addresses" | while read -r ip; do
            echo "  - $ip"
        done
    fi

    echo ""
    echo "IP Set Details:"
    echo "  Name: $IP_SET_NAME"
    echo "  ID: $IP_SET_ID"
    echo "  Scope: $SCOPE"
}

# Add IP to whitelist
add_ip() {
    local new_ip=$1
    validate_ip "$new_ip"

    echo "Adding IP $new_ip to whitelist..."

    # Get current IPs and lock token
    local ip_set_data=$(get_ip_set)
    local current_ips=$(echo "$ip_set_data" | jq -r '.IPSet.Addresses[]')
    local lock_token=$(echo "$ip_set_data" | jq -r '.LockToken')

    # Check if IP already exists
    if echo "$current_ips" | grep -q "^${new_ip}/32$"; then
        echo -e "${YELLOW}IP $new_ip is already whitelisted${NC}"
        exit 0
    fi

    # Build new address list
    local addresses=$(echo "$current_ips"; echo "${new_ip}/32")
    local addresses_json=$(echo "$addresses" | jq -R -s -c 'split("\n") | map(select(length > 0))')

    # Update IP set
    aws wafv2 update-ip-set \
        --name "$IP_SET_NAME" \
        --scope "$SCOPE" \
        --id "$IP_SET_ID" \
        --region "$REGION" \
        --addresses "$addresses_json" \
        --lock-token "$lock_token" \
        --output json > /dev/null

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ IP $new_ip added to whitelist${NC}"
    else
        echo -e "${RED}✗ Failed to add IP to whitelist${NC}"
        exit 1
    fi
}

# Remove IP from whitelist
remove_ip() {
    local remove_ip=$1
    validate_ip "$remove_ip"

    echo "Removing IP $remove_ip from whitelist..."

    # Get current IPs and lock token
    local ip_set_data=$(get_ip_set)
    local current_ips=$(echo "$ip_set_data" | jq -r '.IPSet.Addresses[]')
    local lock_token=$(echo "$ip_set_data" | jq -r '.LockToken')

    # Check if IP exists
    if ! echo "$current_ips" | grep -q "^${remove_ip}/32$"; then
        echo -e "${YELLOW}IP $remove_ip is not in whitelist${NC}"
        exit 0
    fi

    # Build new address list (excluding the IP to remove)
    local addresses=$(echo "$current_ips" | grep -v "^${remove_ip}/32$")
    local addresses_json=$(echo "$addresses" | jq -R -s -c 'split("\n") | map(select(length > 0))')

    # Handle empty list
    if [ "$addresses_json" = "[]" ] || [ -z "$addresses_json" ]; then
        addresses_json="[]"
    fi

    # Update IP set
    aws wafv2 update-ip-set \
        --name "$IP_SET_NAME" \
        --scope "$SCOPE" \
        --id "$IP_SET_ID" \
        --region "$REGION" \
        --addresses "$addresses_json" \
        --lock-token "$lock_token" \
        --output json > /dev/null

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ IP $remove_ip removed from whitelist${NC}"
    else
        echo -e "${RED}✗ Failed to remove IP from whitelist${NC}"
        exit 1
    fi
}

# Clear all IPs
clear_ips() {
    echo "Clearing all IPs from whitelist..."
    read -p "Are you sure? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "Cancelled"
        exit 0
    fi

    # Get lock token
    local lock_token=$(get_ip_set | jq -r '.LockToken')

    # Update with empty list
    aws wafv2 update-ip-set \
        --name "$IP_SET_NAME" \
        --scope "$SCOPE" \
        --id "$IP_SET_ID" \
        --region "$REGION" \
        --addresses "[]" \
        --lock-token "$lock_token" \
        --output json > /dev/null

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ All IPs removed from whitelist${NC}"
    else
        echo -e "${RED}✗ Failed to clear whitelist${NC}"
        exit 1
    fi
}

# Main
if [ $# -eq 0 ]; then
    usage
fi

case $1 in
    list)
        list_ips
        ;;
    add)
        if [ -z "$2" ]; then
            echo -e "${RED}Error: IP address required${NC}"
            usage
        fi
        add_ip "$2"
        ;;
    remove)
        if [ -z "$2" ]; then
            echo -e "${RED}Error: IP address required${NC}"
            usage
        fi
        remove_ip "$2"
        ;;
    clear)
        clear_ips
        ;;
    *)
        echo -e "${RED}Error: Unknown command '$1'${NC}"
        usage
        ;;
esac
