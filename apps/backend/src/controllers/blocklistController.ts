import { Request, Response } from 'express';
import { BlocklistIp } from '../models/BlocklistIp';
import { WAFV2Client, GetIPSetCommand, UpdateIPSetCommand } from '@aws-sdk/client-wafv2';

const wafClient = new WAFV2Client({ region: process.env.AWS_REGION || 'us-east-1' });

// WAF Configuration
const WAF_IP_SET_NAME = process.env.WAF_BLOCKLIST_IP_SET_NAME || 'soc-lite-blocklist-ips';
const WAF_IP_SET_ID = process.env.WAF_BLOCKLIST_IP_SET_ID || '';
const WAF_SCOPE = 'CLOUDFRONT';

/**
 * Get all blocklist IPs with filtering and pagination
 * GET /api/blocklist
 */
export async function getAllBlocklistIps(req: Request, res: Response): Promise<void> {
  try {
    const {
      page,
      limit,
      is_active,
      severity,
      date_from,
      date_to,
      search,
      sortBy,
      sortOrder
    } = req.query;

    const params = {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined,
      severity: severity ? parseInt(severity as string) : undefined,
      date_from: date_from as string | undefined,
      date_to: date_to as string | undefined,
      search: search as string | undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined
    };

    const result = await BlocklistIp.findAll(params);

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Error fetching blocklist IPs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get single blocklist IP by ID
 * GET /api/blocklist/:id
 */
export async function getBlocklistIpById(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid blocklist IP ID'
      });
      return;
    }

    const blocklistIp = await BlocklistIp.findById(id);

    if (!blocklistIp) {
      res.status(404).json({
        success: false,
        error: 'Blocklist IP not found'
      });
      return;
    }

    res.json({
      success: true,
      blocklistIp
    });
  } catch (error: any) {
    console.error('Error fetching blocklist IP:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Create new blocklist IP
 * POST /api/blocklist
 */
export async function createBlocklistIp(req: Request, res: Response): Promise<void> {
  try {
    const {
      ip_address,
      reason,
      severity,
      source_escalation_id,
      source_waf_event_id
    } = req.body;

    // Validate required fields
    if (!ip_address || !severity) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: ip_address, severity'
      });
      return;
    }

    // Validate severity
    if (severity < 0 || severity > 5) {
      res.status(400).json({
        success: false,
        error: 'Severity must be between 0 and 5'
      });
      return;
    }

    // Check if IP already exists
    const existing = await BlocklistIp.findByIpAddress(ip_address);
    if (existing) {
      res.status(409).json({
        success: false,
        error: 'IP address already in blocklist',
        existing_record: existing
      });
      return;
    }

    // Create blocklist IP record
    const blocklistIp = await BlocklistIp.create({
      ip_address,
      reason,
      severity,
      source_escalation_id,
      source_waf_event_id
    });

    // Add to WAF IPSet
    try {
      await addIpToWAF(ip_address);
      console.log(`Added IP ${ip_address} to WAF IPSet`);
    } catch (wafError: any) {
      console.error(`Failed to add IP to WAF: ${wafError.message}`);
      // Don't fail the request, but log the error
    }

    res.status(201).json({
      success: true,
      message: 'Blocklist IP created successfully',
      blocklistIp
    });
  } catch (error: any) {
    console.error('Error creating blocklist IP:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update blocklist IP
 * PUT /api/blocklist/:id
 */
export async function updateBlocklistIp(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid blocklist IP ID'
      });
      return;
    }

    const updates = req.body;

    const blocklistIp = await BlocklistIp.update(id, updates);

    if (!blocklistIp) {
      res.status(404).json({
        success: false,
        error: 'Blocklist IP not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Blocklist IP updated successfully',
      blocklistIp
    });
  } catch (error: any) {
    console.error('Error updating blocklist IP:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Delete blocklist IP
 * DELETE /api/blocklist/:id
 */
export async function deleteBlocklistIp(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid blocklist IP ID'
      });
      return;
    }

    // Get IP before deleting
    const blocklistIp = await BlocklistIp.findById(id);

    if (!blocklistIp) {
      res.status(404).json({
        success: false,
        error: 'Blocklist IP not found'
      });
      return;
    }

    // Remove from WAF if active
    if (blocklistIp.is_active) {
      try {
        await removeIpFromWAF(blocklistIp.ip_address);
        console.log(`Removed IP ${blocklistIp.ip_address} from WAF IPSet`);
      } catch (wafError: any) {
        console.error(`Failed to remove IP from WAF: ${wafError.message}`);
      }
    }

    // Delete from database
    const deleted = await BlocklistIp.delete(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Failed to delete blocklist IP'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Blocklist IP deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting blocklist IP:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get blocklist statistics
 * GET /api/blocklist/stats
 */
export async function getBlocklistStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await BlocklistIp.getStats();

    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Error fetching blocklist stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Sync database with WAF IPSet
 * POST /api/blocklist/sync
 */
export async function syncWithWAF(req: Request, res: Response): Promise<void> {
  try {
    if (!WAF_IP_SET_ID) {
      res.status(400).json({
        success: false,
        error: 'WAF IPSet not configured'
      });
      return;
    }

    // Get active IPs from database
    const dbIps = await BlocklistIp.getActiveIps();

    // Get IPs from WAF
    const wafIps = await getWAFIps();

    // Find discrepancies
    const dbIpsSet = new Set(dbIps);
    const wafIpsSet = new Set(wafIps);

    const missingInWAF = dbIps.filter(ip => !wafIpsSet.has(ip));
    const missingInDB = wafIps.filter(ip => !dbIpsSet.has(ip));

    let addedToWAF = 0;
    let removedFromWAF = 0;

    // Add missing IPs to WAF
    for (const ip of missingInWAF) {
      try {
        await addIpToWAF(ip);
        addedToWAF++;
        console.log(`Added ${ip} to WAF`);
      } catch (error: any) {
        console.error(`Failed to add ${ip} to WAF:`, error.message);
      }
    }

    // Remove extra IPs from WAF (that don't exist in DB)
    for (const ip of missingInDB) {
      try {
        await removeIpFromWAF(ip);
        removedFromWAF++;
        console.log(`Removed ${ip} from WAF`);
      } catch (error: any) {
        console.error(`Failed to remove ${ip} from WAF:`, error.message);
      }
    }

    res.json({
      success: true,
      message: 'Sync completed',
      sync_results: {
        db_ips_count: dbIps.length,
        waf_ips_count: wafIps.length,
        added_to_waf: addedToWAF,
        removed_from_waf: removedFromWAF,
        in_sync: missingInWAF.length === 0 && missingInDB.length === 0
      }
    });
  } catch (error: any) {
    console.error('Error syncing with WAF:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Helper: Get IPs from WAF IPSet
 */
async function getWAFIps(): Promise<string[]> {
  const command = new GetIPSetCommand({
    Name: WAF_IP_SET_NAME,
    Scope: WAF_SCOPE,
    Id: WAF_IP_SET_ID
  });

  const response = await wafClient.send(command);
  return response.IPSet?.Addresses?.map((addr: string) => addr.replace('/32', '')) || [];
}

/**
 * Helper: Add IP to WAF IPSet
 */
async function addIpToWAF(ipAddress: string): Promise<void> {
  // Get current IPSet
  const getCommand = new GetIPSetCommand({
    Name: WAF_IP_SET_NAME,
    Scope: WAF_SCOPE,
    Id: WAF_IP_SET_ID
  });

  const getResponse = await wafClient.send(getCommand);
  const currentAddresses = getResponse.IPSet?.Addresses || [];
  const lockToken = getResponse.LockToken;

  // Add new IP (with /32 CIDR)
  const ipWithCidr = ipAddress.includes('/') ? ipAddress : `${ipAddress}/32`;

  if (currentAddresses.includes(ipWithCidr)) {
    console.log(`IP ${ipAddress} already in WAF IPSet`);
    return;
  }

  const newAddresses = [...currentAddresses, ipWithCidr];

  // Update IPSet
  const updateCommand = new UpdateIPSetCommand({
    Name: WAF_IP_SET_NAME,
    Scope: WAF_SCOPE,
    Id: WAF_IP_SET_ID,
    Addresses: newAddresses,
    LockToken: lockToken
  });

  await wafClient.send(updateCommand);
}

/**
 * Helper: Remove IP from WAF IPSet
 */
async function removeIpFromWAF(ipAddress: string): Promise<void> {
  // Get current IPSet
  const getCommand = new GetIPSetCommand({
    Name: WAF_IP_SET_NAME,
    Scope: WAF_SCOPE,
    Id: WAF_IP_SET_ID
  });

  const getResponse = await wafClient.send(getCommand);
  const currentAddresses = getResponse.IPSet?.Addresses || [];
  const lockToken = getResponse.LockToken;

  // Remove IP
  const ipWithCidr = ipAddress.includes('/') ? ipAddress : `${ipAddress}/32`;
  const newAddresses = currentAddresses.filter((addr: string) => addr !== ipWithCidr);

  if (newAddresses.length === currentAddresses.length) {
    console.log(`IP ${ipAddress} not found in WAF IPSet`);
    return;
  }

  // Update IPSet
  const updateCommand = new UpdateIPSetCommand({
    Name: WAF_IP_SET_NAME,
    Scope: WAF_SCOPE,
    Id: WAF_IP_SET_ID,
    Addresses: newAddresses,
    LockToken: lockToken
  });

  await wafClient.send(updateCommand);
}
