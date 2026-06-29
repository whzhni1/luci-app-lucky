include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI for lucky
LUCI_DEPENDS:=+luci-base +curl
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-lucky
PKG_VERSION:=2.0.3
PKG_RELEASE:=1
PKG_PO_VERSION:=$(PKG_VERSION)

LUCI_MINIFY_JS:=0
LUCI_MINIFY_CSS:=0

include $(TOPDIR)/feeds/luci/luci.mk

define Package/$(PKG_NAME)/conffiles
/etc/config/lucky
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
INITD=/etc/init.d
$${INITD}/lucky enable
$${INITD}/rpcd restart
$${INITD}/lucky restart
rm -rf /tmp/luci-*
exit 0
endef

define Package/$(PKG_NAME)/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
INITD=/etc/init.d
$${INITD}/lucky stop    2>/dev/null || true
$${INITD}/lucky disable 2>/dev/null || true
rm -rf /tmp/luci-*
exit 0
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
