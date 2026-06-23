#!/bin/bash
set -euo pipefail

IPSET_NAME="cdn_ips"
IP_FILE="cdn_ips.txt"
IP_URL="https://raw.githubusercontent.com/zfloong/OpenTermo/main/gcp-firewall/cdn_ips.txt"

echo "📥 下载 IP 列表�?IP_URL"
if ! curl -fsSL -o "$IP_FILE" "$IP_URL"; then
  echo "�?下载失败，脚本终�?
  exit 1
fi

# 删除已存在的 iptables 规则，防�?ipset destroy 报错
for chain in INPUT OUTPUT; do
  if iptables -C "$chain" -m set --match-set "$IPSET_NAME" src -j DROP 2>/dev/null; then
    echo "🧹 删除 iptables 规则: $chain src"
    iptables -D "$chain" -m set --match-set "$IPSET_NAME" src -j DROP
  fi
  if iptables -C "$chain" -m set --match-set "$IPSET_NAME" dst -j DROP 2>/dev/null; then
    echo "🧹 删除 iptables 规则: $chain dst"
    iptables -D "$chain" -m set --match-set "$IPSET_NAME" dst -j DROP
  fi
done

# 如果 ipset 存在则删�?if ipset list -n | grep -qw "$IPSET_NAME"; then
  echo "🧯 ipset $IPSET_NAME 已存在，清空后删�?.."
  ipset flush "$IPSET_NAME"
  ipset destroy "$IPSET_NAME"
fi

# 创建 ipset
echo "📦 创建 ipset�?IPSET_NAME"
ipset create "$IPSET_NAME" hash:net

# 逐行添加 IP，跳过注释和空行
while read -r line; do
  ip=$(echo "$line" | xargs)
  [[ -z "$ip" || "$ip" == \#* ]] && continue
  ipset add "$IPSET_NAME" "$ip"
done < "$IP_FILE"

# 添加 iptables DROP 规则
echo "🚧 添加 iptables 规则拦截 cdn_ips..."
iptables -I INPUT  -m set --match-set "$IPSET_NAME" src -j DROP
iptables -I OUTPUT -m set --match-set "$IPSET_NAME" dst -j DROP

# 删除临时文件
rm -f "$IP_FILE"
echo "�?所有操作完成�?
