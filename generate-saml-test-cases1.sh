#!/bin/bash

# Script para gerar casos de teste SAML para o endpoint /saml-runtime/v1/saml/simulator/request
# Aponta para: https://bo-cmd-facmd.dev.ic.ama.lan
# Compatível com Linux, macOS e Windows (Git Bash/WSL)

set -e  # Parar em caso de erro

BASE_URL="https://bo-cmd-facmd.dev.ic.ama.lan/saml-runtime/v1/saml/simulator/request"
OUTPUT_DIR="./saml-test-cases"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
API_KEY="${API_KEY:-QNEhxz5dukDWWCCIVki4vbOxpjRIITfw}"
DRY_RUN="${DRY_RUN:-false}"  # Se true, apenas gera os JSONs sem fazer requisições

# Detectar sistema operacional
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    IS_WINDOWS=true
else
    IS_WINDOWS=false
fi

# Verificar dependências
command -v curl >/dev/null 2>&1 || { echo "ERRO: curl não está instalado"; exit 1; }

# Verificar jq (opcional)
if command -v jq >/dev/null 2>&1; then
    HAS_JQ=true
else
    HAS_JQ=false
    echo "AVISO: jq não está instalado. Os JSONs não serão formatados."
fi

# Função para gerar UUID compatível com Windows/Linux/Mac
generate_uuid() {
    # Tentar uuidgen (Linux/Mac)
    if command -v uuidgen >/dev/null 2>&1; then
        uuidgen 2>/dev/null && return
    fi
    
    # Tentar PowerShell (Windows)
    if command -v powershell.exe >/dev/null 2>&1; then
        powershell.exe -Command "[guid]::NewGuid().ToString()" 2>/dev/null && return
    fi
    
    # Tentar Python (cross-platform)
    if command -v python3 >/dev/null 2>&1; then
        python3 -c "import uuid; print(uuid.uuid4())" 2>/dev/null && return
    fi
    
    if command -v python >/dev/null 2>&1; then
        python -c "import uuid; print(uuid.uuid4())" 2>/dev/null && return
    fi
    
    # Tentar /proc/sys/kernel/random/uuid (Linux)
    if [ -f /proc/sys/kernel/random/uuid ]; then
        cat /proc/sys/kernel/random/uuid 2>/dev/null && return
    fi
    
    # Fallback: gerar UUID simples baseado em timestamp e random
    # Formato: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    local hex_chars="0123456789abcdef"
    local uuid=""
    local i
    
    # Primeira parte: 8 caracteres
    i=0
    while [ $i -lt 8 ]; do
        uuid="${uuid}${hex_chars:$((RANDOM % 16)):1}"
        i=$((i + 1))
    done
    uuid="${uuid}-"
    
    # Segunda parte: 4 caracteres
    i=0
    while [ $i -lt 4 ]; do
        uuid="${uuid}${hex_chars:$((RANDOM % 16)):1}"
        i=$((i + 1))
    done
    uuid="${uuid}-4"
    
    # Terceira parte: 3 caracteres
    i=0
    while [ $i -lt 3 ]; do
        uuid="${uuid}${hex_chars:$((RANDOM % 16)):1}"
        i=$((i + 1))
    done
    uuid="${uuid}-"
    
    # Quarta parte: 1 caractere (8-b)
    uuid="${uuid}${hex_chars:$((RANDOM % 4 + 8)):1}"
    i=0
    while [ $i -lt 3 ]; do
        uuid="${uuid}${hex_chars:$((RANDOM % 16)):1}"
        i=$((i + 1))
    done
    uuid="${uuid}-"
    
    # Quinta parte: 12 caracteres
    i=0
    while [ $i -lt 12 ]; do
        uuid="${uuid}${hex_chars:$((RANDOM % 16)):1}"
        i=$((i + 1))
    done
    
    echo "$uuid"
}

# Criar diretório de saída
mkdir -p "$OUTPUT_DIR"

echo "Gerando casos de teste SAML..."
echo "Diretório de saída: $OUTPUT_DIR"
if [ "$DRY_RUN" = "true" ]; then
    echo "Modo DRY RUN - apenas gerando JSONs (sem requisições HTTP)"
fi
echo ""

# Função para fazer requisição e salvar resultado
make_request() {
    local case_name=$1
    local json_payload=$2
    local output_file="$OUTPUT_DIR/caso_${case_name}_${TIMESTAMP}.json"
    local curl_file="$OUTPUT_DIR/caso_${case_name}_${TIMESTAMP}.sh"
    
    echo "Gerando caso: $case_name"
    
    # Salvar o payload de entrada
    if [ "$HAS_JQ" = true ]; then
        echo "$json_payload" | jq '.' > "$output_file"
    else
        echo "$json_payload" > "$output_file"
    fi
    
    # Se dry run, apenas salvar o payload
    if [ "$DRY_RUN" = "true" ]; then
        echo "  [DRY RUN] Payload salvo (sem requisição)"
        echo ""
        return
    fi
    
    # Fazer a requisição
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $API_KEY" \
        -d "$json_payload" 2>&1) || {
        echo "  ERRO ao fazer requisição: $response"
        echo ""
        return
    }
    
    # Extrair código HTTP e corpo da resposta (compatível com Windows/Linux/Mac)
    # O curl retorna o body seguido do código HTTP na última linha
    http_code=$(echo "$response" | tail -n 1)
    # Remover a última linha (código HTTP) - método compatível
    body=$(echo "$response" | sed '$d' 2>/dev/null || echo "$response" | head -n -1 2>/dev/null || {
        # Fallback: remover manualmente a última linha
        lines=$(echo "$response" | wc -l)
        if [ "$lines" -gt 1 ]; then
            echo "$response" | head -n $((lines - 1))
        else
            echo ""
        fi
    })
    
    if [ "$http_code" = "200" ]; then
        echo "  OK - Requisição bem-sucedida (HTTP $http_code)"
        # Extrair SAML request e relay state
        if [ "$HAS_JQ" = true ]; then
            saml_request=$(echo "$body" | jq -r '.samlRequest // empty' 2>/dev/null || echo "")
            relay_state=$(echo "$body" | jq -r '.relayState // empty' 2>/dev/null || echo "")
        else
            # Fallback sem jq - extração básica
            saml_request=$(echo "$body" | grep -o '"samlRequest"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")
            relay_state=$(echo "$body" | grep -o '"relayState"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")
        fi
        
        # Gerar comando curl para /authorize
        if [ -n "$saml_request" ] && [ "$saml_request" != "null" ] && [ -n "$relay_state" ]; then
            # Gerar UUID para X-RequestID (compatível com Windows/Linux/Mac)
            request_id=$(generate_uuid)
            
            # URL encode os valores (curl faz isso automaticamente com --data-urlencode)
            cat > "$curl_file" <<EOF
#!/bin/bash
# Comando curl para autorizar o caso: $case_name
# Gerado em: $(date)

curl -X POST "https://bo-cmd-facmd.dev.ic.ama.lan/saml-runtime/v1/saml/authorize" \\
  -H "IDGOVPTAUTH: " \\
  -H "X-RequestID: $request_id" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  --data-urlencode "SAMLRequest=$saml_request" \\
  --data-urlencode "RelayState=$relay_state"
EOF
            # Tornar executável (funciona no Git Bash/WSL, ignora erro no Windows nativo)
            chmod +x "$curl_file" 2>/dev/null || true
            echo "  Comando curl gerado: $(basename "$curl_file")"
        else
            echo "  AVISO: Não foi possível extrair SAMLRequest ou RelayState da resposta"
        fi
    else
        echo "  ERRO - Requisição falhou (HTTP $http_code)"
        echo "  Resposta: $body"
    fi
    echo ""
}

# Caso 1: Básico - Nível 3, CC e CMD visíveis, apenas NomeCompleto
echo "=== CASO 1: Básico - Nível 3, CC e CMD ==="
make_request "01_basico_nivel3" '{
  "entidadeCredenciadora": "Teste Caso 1 - Básico",
  "faaaLevel": 3,
  "returnUri": "https://bo-cmd-facmd.dev.ic.ama.lan/callback",
  "forceAuthnAGov": false,
  "requestedAttributes": [
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NomeCompleto",
      "required": true
    }
  ],
  "authTabPresentationPolicies": [
    {
      "name": "CC",
      "visible": true
    },
    {
      "name": "CMD",
      "visible": true
    }
  ]
}'

# Caso 2: Nível 1 (MINIMAL) - Apenas CMD, múltiplos atributos básicos
echo "=== CASO 2: Nível 1 (MINIMAL) - Apenas CMD ==="
make_request "02_nivel1_cmd" '{
  "entidadeCredenciadora": "Teste Caso 2 - Nível 1 CMD",
  "faaaLevel": 1,
  "returnUri": "https://bo-cmd-facmd.dev.ic.ama.lan/callback",
  "forceAuthnAGov": false,
  "requestedAttributes": [
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NomeCompleto",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/DataNascimento",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NIC",
      "required": false
    }
  ],
  "authTabPresentationPolicies": [
    {
      "name": "CMD",
      "visible": true
    },
    {
      "name": "CC",
      "visible": false
    }
  ]
}'

# Caso 3: Nível 2 (LOW) - CMD Email, atributos de contato
echo "=== CASO 3: Nível 2 (LOW) - CMD Email ==="
make_request "03_nivel2_cmd_email" '{
  "entidadeCredenciadora": "Teste Caso 3 - Nível 2 CMD Email",
  "faaaLevel": 2,
  "returnUri": "https://bo-cmd-facmd.dev.ic.ama.lan/callback",
  "forceAuthnAGov": false,
  "requestedAttributes": [
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NomeCompleto",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/CorreioElectronico",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NumeroTelemovel",
      "required": false
    }
  ],
  "authTabPresentationPolicies": [
    {
      "name": "CMD",
      "visible": true
    },
    {
      "name": "CC",
      "visible": true
    }
  ]
}'

# Caso 4: Nível 3 (SUBSTANTIAL) - Apenas CC, múltiplos atributos
echo "=== CASO 4: Nível 3 (SUBSTANTIAL) - Apenas CC ==="
make_request "04_nivel3_cc" '{
  "entidadeCredenciadora": "Teste Caso 4 - Nível 3 CC",
  "faaaLevel": 3,
  "returnUri": "https://bo-cmd-facmd.dev.ic.ama.lan/callback",
  "forceAuthnAGov": false,
  "requestedAttributes": [
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NomeCompleto",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NomeProprio",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NomeApelido",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/DataNascimento",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NIC",
      "required": false
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NIF",
      "required": false
    }
  ],
  "authTabPresentationPolicies": [
    {
      "name": "CC",
      "visible": true
    },
    {
      "name": "CMD",
      "visible": false
    }
  ]
}'

# Caso 5: Nível 4 (HIGH) - Apenas CC, forceAuthnAGov ativado
echo "=== CASO 5: Nível 4 (HIGH) - Force Authn AGov ==="
make_request "05_nivel4_force_authn" '{
  "entidadeCredenciadora": "Teste Caso 5 - Nível 4 Force Authn",
  "faaaLevel": 4,
  "returnUri": "https://bo-cmd-facmd.dev.ic.ama.lan/callback",
  "forceAuthnAGov": true,
  "requestedAttributes": [
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NomeCompleto",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NIC",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NIF",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NISS",
      "required": false
    }
  ],
  "authTabPresentationPolicies": [
    {
      "name": "CC",
      "visible": true
    }
  ]
}'

# Caso 6: Nível 3 - Atributos de documento e nacionalidade
echo "=== CASO 6: Nível 3 - Atributos de Documento ==="
make_request "06_nivel3_documento" '{
  "entidadeCredenciadora": "Teste Caso 6 - Documento e Nacionalidade",
  "faaaLevel": 3,
  "returnUri": "https://bo-cmd-facmd.dev.ic.ama.lan/callback",
  "forceAuthnAGov": false,
  "requestedAttributes": [
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NomeCompleto",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/DocNumber",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/DocType",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/DocNationality",
      "required": false
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/Nacionalidade",
      "required": false
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/CodigoNacionalidade",
      "required": false
    }
  ],
  "authTabPresentationPolicies": [
    {
      "name": "CC",
      "visible": true
    },
    {
      "name": "CMD",
      "visible": true
    }
  ]
}'

# Caso 7: Nível 2 - Atributos de morada e contacto
echo "=== CASO 7: Nível 2 - Morada e Contacto ==="
make_request "07_nivel2_morada_contacto" '{
  "entidadeCredenciadora": "Teste Caso 7 - Morada e Contacto",
  "faaaLevel": 2,
  "returnUri": "https://bo-cmd-facmd.dev.ic.ama.lan/callback",
  "forceAuthnAGov": false,
  "requestedAttributes": [
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NomeCompleto",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MoradaCC/MoradaXML",
      "required": false
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/CorreioElectronico",
      "required": false
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NumeroTelemovel",
      "required": false
    }
  ],
  "authTabPresentationPolicies": [
    {
      "name": "CMD",
      "visible": true
    },
    {
      "name": "CC",
      "visible": true
    }
  ]
}'

# Caso 8: Nível 3 - Múltiplos atributos opcionais
echo "=== CASO 8: Nível 3 - Múltiplos Atributos Opcionais ==="
make_request "08_nivel3_multiplos_atributos" '{
  "entidadeCredenciadora": "Teste Caso 8 - Múltiplos Atributos",
  "faaaLevel": 3,
  "returnUri": "https://bo-cmd-facmd.dev.ic.ama.lan/callback",
  "forceAuthnAGov": false,
  "requestedAttributes": [
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NomeCompleto",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NIC",
      "required": false
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NIF",
      "required": false
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NISS",
      "required": false
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NSNS",
      "required": false
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/DataValidade",
      "required": false
    }
  ],
  "authTabPresentationPolicies": [
    {
      "name": "CC",
      "visible": true
    },
    {
      "name": "CMD",
      "visible": true
    }
  ]
}'

# Caso 9: Nível 1 - Mínimo necessário, apenas CMD
echo "=== CASO 9: Nível 1 - Mínimo Necessário ==="
make_request "09_nivel1_minimo" '{
  "entidadeCredenciadora": "Teste Caso 9 - Mínimo Necessário",
  "faaaLevel": 1,
  "returnUri": "https://bo-cmd-facmd.dev.ic.ama.lan/callback",
  "forceAuthnAGov": false,
  "requestedAttributes": [
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NomeCompleto",
      "required": true
    }
  ],
  "authTabPresentationPolicies": [
    {
      "name": "CMD",
      "visible": true
    }
  ]
}'

# Caso 10: Nível 3 - Passport e atributos internacionais
echo "=== CASO 10: Nível 3 - Passport e Atributos Internacionais ==="
make_request "10_nivel3_passport" '{
  "entidadeCredenciadora": "Teste Caso 10 - Passport",
  "faaaLevel": 3,
  "returnUri": "https://bo-cmd-facmd.dev.ic.ama.lan/callback",
  "forceAuthnAGov": false,
  "requestedAttributes": [
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NomeCompleto",
      "required": true
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/Passport",
      "required": false
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/NIE",
      "required": false
    },
    {
      "name": "http://interop.gov.pt/MDC/Cidadao/Nacionalidade",
      "required": false
    }
  ],
  "authTabPresentationPolicies": [
    {
      "name": "CC",
      "visible": true
    },
    {
      "name": "CMD",
      "visible": true
    }
  ]
}'

echo "Geração de casos de teste concluída!"
echo ""
echo "  - Diretório: $OUTPUT_DIR"
echo "  - Timestamp: $TIMESTAMP"
echo ""
echo "Arquivos gerados por caso:"
echo "  - caso_XX_nome_timestamp.json (payload de entrada)"
echo "  - caso_XX_nome_timestamp.sh (comando curl para /authorize)"
echo ""
echo "Para usar os comandos curl gerados:"
echo "  ./caso_XX_nome_timestamp.sh"
echo ""