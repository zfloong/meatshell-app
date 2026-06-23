# GCP Free Tier — CDN Firewall Block

Google Cloud free-tier VMs charge egress traffic through Akamai/Cloudflare/Fastly CDNs.
This firewall blocks outbound connections to those CDN IP ranges using iptables + ipset.

## Files

| File | Purpose |
|------|---------|
| cdn_ips.txt | IP ranges for Cloudflare + Fastly (source of truth) |
| cdn_block.sh | One-shot script: downloads IPs, creates ipset + iptables rules |
| cdn-block.service | systemd oneshot: runs script on every boot |

## Usage

`ash
# One-time run
sudo bash cdn_block.sh

# Or: auto-run on every boot
sudo cp cdn-block.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cdn-block.service
`

## Updating IPs

Edit cdn_ips.txt, push to GitHub. Servers will pick up new IPs on next reboot.
