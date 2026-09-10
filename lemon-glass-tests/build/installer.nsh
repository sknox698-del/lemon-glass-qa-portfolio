!macro customInstall
  ; A genuinely new installation starts blank; updates preserve the user's accounts.
  ${IfNot} ${isUpdated}
    RMDir /r "$APPDATA\Lemon Glass"
    RMDir /r "$APPDATA\avera-personal-finance"
  ${EndIf}
!macroend
