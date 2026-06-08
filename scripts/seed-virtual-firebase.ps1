$ErrorActionPreference = "Stop"

$base = "https://projectiot-final-default-rtdb.firebaseio.com"

function Send-FirebaseJson {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][object]$Data,
    [ValidateSet("Put","Patch")][string]$Method = "Put"
  )

  $json = $Data | ConvertTo-Json -Depth 20
  Invoke-RestMethod -Uri "$base/$Path.json" -Method $Method -ContentType "application/json; charset=utf-8" -Body $json | Out-Null
}

function New-History {
  param(
    [Parameter(Mandatory=$true)][object]$Vehicle,
    [Parameter(Mandatory=$true)][object[]]$Path
  )

  $now = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
  $history = @{}

  for ($i = 0; $i -lt $Path.Count; $i++) {
    $createdAt = $now - (($Path.Count - 1 - $i) * 60000)
    $time = [DateTimeOffset]::FromUnixTimeMilliseconds($createdAt).LocalDateTime
    $passengerWave = [Math]::Max(0, [Math]::Round([Math]::Sin($i / 2.0) * 2))
    $irIn = [int]$Vehicle.irIn + $passengerWave
    $irOut = [int]$Vehicle.irOut
    $passengers = [Math]::Max(0, $irIn - $irOut)

    $history[[string]$createdAt] = @{
      vehicleId = $Vehicle.id
      name = $Vehicle.name
      type = "bus"
      routeId = $Vehicle.routeId
      lat = [double]$Path[$i].lat
      lng = [double]$Path[$i].lng
      speed = [int]$Vehicle.speed
      irIn = $irIn
      irOut = $irOut
      passengers = $passengers
      capacity = [int]$Vehicle.capacity
      currentStop = $Vehicle.currentStop
      nextStop = $Vehicle.nextStop
      isVirtual = $true
      mq2Alert = $false
      date = $time.ToString("dd/MM/yyyy")
      time = $time.ToString("HH:mm:ss")
      createdAt = $createdAt
    }
  }

  return $history
}

$routes = @{
  route_02 = @{
    id = "route_02"; name = "Tuyen 02"; type = "bus"; color = "#22c55e"
    stops = @(
      @{ id = "r02_1"; name = "KTX Khu A"; lat = 10.8799; lng = 106.8069 },
      @{ id = "r02_2"; name = "Ho Da"; lat = 10.8794; lng = 106.8012 },
      @{ id = "r02_3"; name = "DHQG Trung tam"; lat = 10.8760; lng = 106.7972 },
      @{ id = "r02_4"; name = "UEL"; lat = 10.8725; lng = 106.7898 },
      @{ id = "r02_5"; name = "DH Bach Khoa"; lat = 10.8802; lng = 106.7854 },
      @{ id = "r02_6"; name = "Nha van hoa Sinh vien"; lat = 10.8757; lng = 106.8058 }
    )
    path = @(
      @{ lat = 10.8799; lng = 106.8069 },
      @{ lat = 10.8790; lng = 106.8038 },
      @{ lat = 10.8794; lng = 106.8012 },
      @{ lat = 10.8776; lng = 106.7991 },
      @{ lat = 10.8760; lng = 106.7972 },
      @{ lat = 10.8741; lng = 106.7939 },
      @{ lat = 10.8725; lng = 106.7898 },
      @{ lat = 10.8756; lng = 106.7869 },
      @{ lat = 10.8802; lng = 106.7854 },
      @{ lat = 10.8788; lng = 106.7920 },
      @{ lat = 10.8757; lng = 106.8058 }
    )
    schedule = @("06:10","06:40","07:10","07:40","08:10","08:40","16:10","16:40","17:10","17:40")
  }
  route_03 = @{
    id = "route_03"; name = "Tuyen 03"; type = "bus"; color = "#f59e0b"
    stops = @(
      @{ id = "r03_1"; name = "Ho Da"; lat = 10.8793; lng = 106.8000 },
      @{ id = "r03_2"; name = "Heart Lake"; lat = 10.8755; lng = 106.8020 },
      @{ id = "r03_3"; name = "Nga tu DHQG"; lat = 10.8708; lng = 106.8012 },
      @{ id = "r03_4"; name = "Ben xe DHQG"; lat = 10.8688; lng = 106.7970 },
      @{ id = "r03_5"; name = "Khu Cong nghe Phan mem"; lat = 10.8657; lng = 106.8028 },
      @{ id = "r03_6"; name = "DH Quoc te"; lat = 10.8782; lng = 106.8066 }
    )
    path = @(
      @{ lat = 10.8793; lng = 106.8000 },
      @{ lat = 10.8778; lng = 106.8010 },
      @{ lat = 10.8755; lng = 106.8020 },
      @{ lat = 10.8727; lng = 106.8018 },
      @{ lat = 10.8708; lng = 106.8012 },
      @{ lat = 10.8697; lng = 106.7990 },
      @{ lat = 10.8688; lng = 106.7970 },
      @{ lat = 10.8667; lng = 106.7996 },
      @{ lat = 10.8657; lng = 106.8028 },
      @{ lat = 10.8705; lng = 106.8050 },
      @{ lat = 10.8782; lng = 106.8066 }
    )
    schedule = @("05:45","06:15","06:45","07:15","07:45","08:15","15:45","16:15","16:45","17:15")
  }
  route_04 = @{
    id = "route_04"; name = "Tuyen 04"; type = "bus"; color = "#a855f7"
    stops = @(
      @{ id = "r04_1"; name = "Nguyen Du"; lat = 10.8810; lng = 106.8101 },
      @{ id = "r04_2"; name = "Ho Quoc Phong"; lat = 10.8778; lng = 106.8062 },
      @{ id = "r04_3"; name = "KTX Khu A"; lat = 10.8749; lng = 106.8074 },
      @{ id = "r04_4"; name = "DH KHTN"; lat = 10.8717; lng = 106.8033 },
      @{ id = "r04_5"; name = "Suoi Tien"; lat = 10.8703; lng = 106.8141 }
    )
    path = @(
      @{ lat = 10.8810; lng = 106.8101 },
      @{ lat = 10.8796; lng = 106.8087 },
      @{ lat = 10.8778; lng = 106.8062 },
      @{ lat = 10.8762; lng = 106.8069 },
      @{ lat = 10.8749; lng = 106.8074 },
      @{ lat = 10.8717; lng = 106.8033 },
      @{ lat = 10.8699; lng = 106.8079 },
      @{ lat = 10.8703; lng = 106.8141 }
    )
    schedule = @("06:20","06:50","07:20","07:50","08:20","16:20","16:50","17:20","17:50")
  }
}

$vehicles = @{
  bus_002 = @{
    id = "bus_002"; name = "Xe 02"; type = "bus"; routeId = "route_02"
    lat = 10.8776; lng = 106.7991; speed = 28; irIn = 44; irOut = 13; passengers = 31; capacity = 60
    status = "on_time"; currentStop = "Ho Da"; nextStop = "DHQG Trung tam"; isVirtual = $true
  }
  bus_003 = @{
    id = "bus_003"; name = "Xe 03"; type = "bus"; routeId = "route_03"
    lat = 10.8708; lng = 106.8012; speed = 18; irIn = 62; irOut = 14; passengers = 48; capacity = 60
    status = "delayed"; currentStop = "Nga tu DHQG"; nextStop = "Ben xe DHQG"; isVirtual = $true
  }
  bus_004 = @{
    id = "bus_004"; name = "Xe 04"; type = "bus"; routeId = "route_04"
    lat = 10.8778; lng = 106.8062; speed = 24; irIn = 27; irOut = 8; passengers = 19; capacity = 50
    status = "on_time"; currentStop = "Ho Quoc Phong"; nextStop = "KTX Khu A"; isVirtual = $true
  }
}

foreach ($routeId in $routes.Keys) {
  Send-FirebaseJson -Path "routes/$routeId" -Data $routes[$routeId] -Method Put
}

foreach ($vehicleId in $vehicles.Keys) {
  $vehicle = $vehicles[$vehicleId]
  $route = $routes[$vehicle.routeId]
  Send-FirebaseJson -Path "vehicles/$vehicleId" -Data $vehicle -Method Put
  Send-FirebaseJson -Path "vehicleHistory/$vehicleId" -Data (New-History -Vehicle $vehicle -Path $route.path) -Method Patch
}

Send-FirebaseJson -Path "metadata/virtualFleet" -Data @{
  seededAt = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
  vehicleIds = @("bus_002","bus_003","bus_004")
  routeIds = @("route_02","route_03","route_04")
} -Method Put

Write-Output "Seeded virtual routes, vehicles, and history to Firebase."
